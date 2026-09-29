const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "cz.flyerscze.animace",
    version: "1.2.0",
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
                    options: [
                        "0",
                        "30",
                        "60",
                        "90",
                        "120",
                        "150",
                        "180",
                        "210",
                        "240",
                        "270",
                        "300"
                    ],
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
                    options: [
                        "0",
                        "30",
                        "60",
                        "90",
                        "120",
                        "150",
                        "180",
                        "210",
                        "240",
                        "270",
                        "300"
                    ],
                    isRequired: false
                }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

const CINEMETA = "https://v3-cinemeta.strem.io";

async function nactiKatalog(type, skip) {

    let url;

    if (skip > 0) {

        url =
            `${CINEMETA}/catalog/${type}/top/genre=Animation/skip=${skip}.json`;

    } else {

        url =
            `${CINEMETA}/catalog/${type}/top/genre=Animation.json`;

    }

    console.log("Cinemeta URL:", url);

    try {

        const response = await fetch(url);

        if (!response.ok) {

            console.error(
                `Cinemeta HTTP ${response.status}`
            );

            return [];
        }

        const data = await response.json();

        console.log(
            `Cinemeta vrátila ${data.metas?.length || 0} položek`
        );

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

    const skip =
        Number(args.extra?.skip || 0);

    console.log(
        `Požadavek: ${args.type}, skip=${skip}`
    );

    if (
        args.type === "movie" &&
        args.id === "cinemeta_animation_movies"
    ) {

        const metas =
            await nactiKatalog(
                "movie",
                skip
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
                skip
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
