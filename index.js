const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "cz.flyerscze.animace",
    version: "1.0.0",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Animované filmy a seriály z Cinemeta – Popular + Animation.",
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

    const url =
        `${CINEMETA}/catalog/${type}/top/genre=Animation.json?skip=${skip}`;

    console.log(
        `Cinemeta požadavek: ${type}, skip=${skip}`
    );

    try {

        const response = await fetch(url);

        if (!response.ok) {

            console.error(
                `Cinemeta HTTP chyba: ${response.status}`
            );

            return [];
        }

        const data = await response.json();

        return data.metas || [];

    } catch (error) {

        console.error(
            "Chyba při načítání Cinemety:",
            error
        );

        return [];
    }
}

builder.defineCatalogHandler(async (args) => {

    let skip = 0;

    if (
        args.extra &&
        args.extra.skip !== undefined
    ) {
        skip = Number(args.extra.skip) || 0;
    }

    if (
        args.type === "movie" &&
        args.id === "cinemeta_animation_movies"
    ) {

        const metas =
            await nactiAnimace(
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

        const metas =
            await nactiAnimace(
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

const port =
    process.env.PORT || 7000;

serveHTTP(
    builder.getInterface(),
    {
        port
    }
);
