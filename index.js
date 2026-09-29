const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "cz.flyerscze.animace",
    version: "1.0.1",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Animované filmy a seriály z Cinemety – Popular + Animation.",
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

async function nactiAnimace(type, skip) {

    let url;

    if (skip > 0) {
        url =
            `${CINEMETA}/catalog/${type}/top/genre=Animation&skip=${skip}.json`;
    } else {
        url =
            `${CINEMETA}/catalog/${type}/top/genre=Animation.json`;
    }

    console.log("Cinemeta URL:", url);

    try {

        const response = await fetch(url);

        if (!response.ok) {
            console.error(
                "Cinemeta HTTP chyba:",
                response.status
            );
            return [];
        }

        const data = await response.json();

        return data.metas || [];

    } catch (error) {

        console.error(
            "Chyba Cinemeta:",
            error
        );

        return [];
    }
}

builder.defineCatalogHandler(async (args) => {

    const skip =
        Number(args.extra?.skip || 0);

    if (
        args.id === "cinemeta_animation_movies" &&
        args.type === "movie"
    ) {

        const metas =
            await nactiAnimace(
                "movie",
                skip
            );

        console.log(
            `FILMY | skip=${skip} | ${metas.length} položek`
        );

        return {
            metas
        };
    }

    if (
        args.id === "cinemeta_animation_series" &&
        args.type === "series"
    ) {

        const metas =
            await nactiAnimace(
                "series",
                skip
            );

        console.log(
            `SERIÁLY | skip=${skip} | ${metas.length} položek`
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
