const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "cz.flyerscze.animace",
    version: "1.0.0",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Zobrazí animované filmy a seriály bez japonského anime.",
    resources: ["catalog"],
    types: ["movie", "series"],
    catalogs: [
        {
            type: "movie",
            id: "cinemeta_animation_movies",
            name: "🧸 Animovaný svět: Filmy",
            extra: [
                {
                    name: "skip",
                    options: ["0", "100", "200", "300", "400", "500"],
                    isRequired: false
                }
            ]
        },
        {
            type: "series",
            id: "cinemeta_animation_series",
            name: "📺 Animovaný svět: Seriály",
            extra: [
                {
                    name: "skip",
                    options: ["0", "100", "200", "300", "400", "500"],
                    isRequired: false
                }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

async function nactiCinemetaStranku(contentType, skip) {
    const url =
        `https://v3-cinemeta.strem.io/catalog/${contentType}/top/genre=Animation.json?skip=${skip}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Cinemeta HTTP ${response.status}`);
        }

        const data = await response.json();

        return data.metas || [];

    } catch (error) {
        console.error("Chyba Cinemeta katalogu:", error);
        return [];
    }
}

async function jeAnime(contentType, meta) {
    try {
        const detailUrl =
            `https://v3-cinemeta.strem.io/meta/${contentType}/${meta.id}.json`;

        const response = await fetch(detailUrl);

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        const detail = data.meta;

        if (!detail) {
            return false;
        }

        const country = String(detail.country || "").toLowerCase();
        const language = String(detail.language || "").toLowerCase();

        return (
            country.includes("japan") ||
            country.includes("japonsko") ||
            country.includes("japan") ||
            language.includes("japanese") ||
            language.includes("japan")
        );

    } catch (error) {
        return false;
    }
}

async function filtrujAnime(contentType, metas) {

    const results = await Promise.all(
        metas.map(async (meta) => {

            const anime = await jeAnime(contentType, meta);

            if (anime) {
                return null;
            }

            return meta;
        })
    );

    return results.filter(meta => meta !== null);
}

async function ziskejStranku(contentType, requestedSkip) {

    const potrebujeme = 100;

    let vhodneTituly = [];
    let sourceSkip = 0;

    /*
     * Protože část titulů odstraníme jako japonské anime,
     * načítáme Cinemetu po 100 a sbíráme dostatek vhodných titulů.
     */
    while (
        vhodneTituly.length < requestedSkip + potrebujeme &&
        sourceSkip <= 900
    ) {

        const metas = await nactiCinemetaStranku(
            contentType,
            sourceSkip
        );

        if (!metas.length) {
            break;
        }

        const filtrovane = await filtrujAnime(
            contentType,
            metas
        );

        vhodneTituly.push(...filtrovane);

        sourceSkip += 100;

        /*
         * Pokud Cinemeta vrátila méně než 100 položek,
         * pravděpodobně jsme na konci katalogu.
         */
        if (metas.length < 100) {
            break;
        }
    }

    return vhodneTituly.slice(
        requestedSkip,
        requestedSkip + potrebujeme
    );
}

builder.defineCatalogHandler(async (args) => {

    const requestedSkip =
        parseInt(args.extra?.skip || "0", 10);

    if (
        args.type === "movie" &&
        args.id === "cinemeta_animation_movies"
    ) {

        const data = await ziskejStranku(
            "movie",
            requestedSkip
        );

        return {
            metas: data
        };
    }

    if (
        args.type === "series" &&
        args.id === "cinemeta_animation_series"
    ) {

        const data = await ziskejStranku(
            "series",
            requestedSkip
        );

        return {
            metas: data
        };
    }

    return {
        metas: []
    };
});

const port = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), {
    port: port
});
