const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "cz.flyerscze.animace",
    version: "1.1.0",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Popular animované filmy a seriály z Cinemety.",
    resources: ["catalog"],
    types: ["movie", "series"],

    catalogs: [
        {
            type: "movie",
            id: "cinemeta_animation_movies",
            name: "🧸 Animovaný svět: Filmy",

            extra: [
                {
                    name: "genre",
                    options: ["Animation"],
                    isRequired: true
                },
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
                    name: "genre",
                    options: ["Animation"],
                    isRequired: true
                },
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

async function nactiKatalog(type, genre, skip) {

    const params = new URLSearchParams();

    if (genre) {
        params.set("genre", genre);
    }

    if (skip > 0) {
        params.set("skip", String(skip));
    }

    const url =
        `${CINEMETA}/catalog/${type}/top.json?${params.toString()}`;

    console.log("Cinemeta:", url);

    try {

        const response = await fetch(url);

        if (!response.ok) {
            console.error(
                `Cinemeta HTTP ${response.status}`
            );

            return [];
        }

        const data = await response.json();

        return data.metas || [];

    } catch (error) {

        console.error(
            "Chyba Cinemety:",
            error
        );

        return [];
    }
}

builder.defineCatalogHandler(async (args) => {

    const genre =
        args.extra?.genre || "Animation";

    const skip =
        Number(args.extra?.skip || 0);

    console.log(
        `Katalog: ${args.type}, genre=${genre}, skip=${skip}`
    );

    if (
        args.type === "movie" &&
        args.id === "cinemeta_animation_movies"
    ) {

        const metas =
            await nactiKatalog(
                "movie",
                genre,
                skip
            );

        console.log(
            `FILMY: ${metas.length} položek`
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
            await nactiKatalog(
                "series",
                genre,
                skip
            );

        console.log(
            `SERIÁLY: ${metas.length} položek`
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
