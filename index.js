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

// Cache výsledků, aby se stejné tituly
// nemusely kontrolovat znovu.
const animeCache = new Map();

async function nactiKatalog(type, skip) {
    const url =
        `${CINEMETA}/catalog/${type}/top/genre=Animation.json?skip=${skip}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Cinemeta HTTP ${response.status}`);
        }

        const data = await response.json();

        return data.metas || [];

    } catch (error) {
        console.error("Chyba katalogu:", error);
        return [];
    }
}


// Kontrola jednoho titulu.
async function jeAnime(type, meta) {

    if (animeCache.has(meta.id)) {
        return animeCache.get(meta.id);
    }

    try {

        const url =
            `${CINEMETA}/meta/${type}/${meta.id}.json`;

        const response = await fetch(url);

        if (!response.ok) {
            animeCache.set(meta.id, false);
            return false;
        }

        const data = await response.json();
        const detail = data.meta;

        if (!detail) {
            animeCache.set(meta.id, false);
            return false;
        }

        const country =
            String(detail.country || "").toLowerCase();

        const language =
            String(detail.language || "").toLowerCase();

        const result =
            country.includes("japan") ||
            country.includes("japonsko") ||
            language.includes("japanese");

        animeCache.set(meta.id, result);

        return result;

    } catch (error) {

        // Když detail nejde načíst,
        // titul ponecháme.
        animeCache.set(meta.id, false);

        return false;
    }
}


// Kontrola titulů po menších dávkách.
// Nezatíží Render stovkami požadavků současně.
async function filtrujAnime(type, metas) {

    const vysledky = [];

    const BATCH_SIZE = 10;

    for (
        let i = 0;
        i < metas.length;
        i += BATCH_SIZE
    ) {

        const batch =
            metas.slice(i, i + BATCH_SIZE);

        const kontrola =
            await Promise.all(
                batch.map(async meta => {

                    const anime =
                        await jeAnime(type, meta);

                    return {
                        meta,
                        anime
                    };
                })
            );

        for (const item of kontrola) {

            if (!item.anime) {
                vysledky.push(item.meta);
            }
        }
    }

    return vysledky;
}


async function vytvorStranku(type, requestedSkip) {

    const PAGE_SIZE = 100;

    /*
     * Nejdříve načteme stránku Popular + Animation.
     */
    const metas =
        await nactiKatalog(type, requestedSkip);

    if (!metas.length) {
        return [];
    }

    /*
     * Odstraníme japonské anime.
     *
     * Kontrola probíhá po dávkách,
     * aby Render nezkolaboval.
     */
    const filtrovane =
        await filtrujAnime(type, metas);

    return filtrovane.slice(0, PAGE_SIZE);
}


builder.defineCatalogHandler(async (args) => {

    const skip =
        Number(args.extra?.skip || 0);

    if (
        args.type === "movie" &&
        args.id === "cinemeta_animation_movies"
    ) {

        const metas =
            await vytvorStranku(
                "movie",
                skip
            );

        console.log(
            `Filmy: skip=${skip}, počet=${metas.length}`
        );

        return {
            metas
        };
    }


    if (
        args.type === "series" &&
        args.id === "cinemeta_animation_series"
    ) {

        const metas =
            await vytvorStranku(
                "series",
                skip
            );

        console.log(
            `Seriály: skip=${skip}, počet=${metas.length}`
        );

        return {
            metas
        };
    }


    return {
        metas: []
    };
});


const port =
    process.env.PORT || 7000;


serveHTTP(
    builder.getInterface(),
    {
        port
    }
);
