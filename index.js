const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "cz.flyerscze.animace",
    version: "1.0.0",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Velký katalog populárních animovaných filmů a seriálů bez japonského anime.",
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
                    isRequired: false
                }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

const CINEMETA = "https://v3-cinemeta.strem.io";

async function nactiKatalog(contentType, skip) {
    const url =
        `${CINEMETA}/catalog/${contentType}/top/genre=Animation.json?skip=${skip}`;

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

async function jeJaponskeAnime(contentType, meta) {
    try {
        const url =
            `${CINEMETA}/meta/${contentType}/${meta.id}.json`;

        const response = await fetch(url);

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

        if (
            country.includes("japan") ||
            country.includes("japonsko") ||
            language.includes("japanese")
        ) {
            return true;
        }

        return false;

    } catch (error) {
        return false;
    }
}

async function filtrujAnime(contentType, metas) {

    const vysledky = await Promise.all(
        metas.map(async (meta) => {

            const anime = await jeJaponskeAnime(
                contentType,
                meta
            );

            return anime ? null : meta;
        })
    );

    return vysledky.filter(Boolean);
}

async function vytvorStranku(contentType, requestedSkip) {

    const PAGE_SIZE = 100;

    let vsechnyVhodne = [];

    let cinemetaSkip = 0;

    /*
     * Načítáme další stránky Cinemety,
     * dokud nemáme dost ne-japonských titulů
     * pro požadovanou stránku Stremia.
     */
    while (
        vsechnyVhodne.length < requestedSkip + PAGE_SIZE &&
        cinemetaSkip < 2000
    ) {

        const metas = await nactiKatalog(
            contentType,
            cinemetaSkip
        );

        if (!metas.length) {
            break;
        }

        const vhodne = await filtrujAnime(
            contentType,
            metas
        );

        vsechnyVhodne.push(...vhodne);

        /*
         * Další stránka Cinemety.
         */
        cinemetaSkip += 100;

        /*
         * Konec zdroje.
         */
        if (metas.length < 100) {
            break;
        }
    }

    return vsechnyVhodne.slice(
        requestedSkip,
        requestedSkip + PAGE_SIZE
    );
}

builder.defineCatalogHandler(async (args) => {

    const skip = Number(args.extra?.skip || 0);

    if (
        args.type === "movie" &&
        args.id === "cinemeta_animation_movies"
    ) {

        const metas = await vytvorStranku(
            "movie",
            skip
        );

        console.log(
            `Animované filmy: skip=${skip}, počet=${metas.length}`
        );

        return {
            metas
        };
    }

    if (
        args.type === "series" &&
        args.id === "cinemeta_animation_series"
    ) {

        const metas = await vytvorStranku(
            "series",
            skip
        );

        console.log(
            `Animované seriály: skip=${skip}, počet=${metas.length}`
        );

        return {
            metas
        };
    }

    return {
        metas: []
    };
});

const port = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), {
