const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "cz.flyerscze.animace",
    version: "1.0.0",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Zobrazí animované filmy a seriály ze sekce Objevit na domovské obrazovce.",
    resources: ["catalog"],
    types: ["movie", "series"],
    catalogs: [
        {
            type: "movie",
            id: "cinemeta_animation_movies",
            name: "🧸 Animovaný svět: Filmy"
        },
        {
            type: "series",
            id: "cinemeta_animation_series",
            name: "📺 Animovaný svět: Seriály"
        }
    ]
};

const builder = new addonBuilder(manifest);

async function ziskejCinemetaData(contentType) {
    const url = `https://v3-cinemeta.strem.io/catalog/${contentType}/top/genre=Animation.json`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Cinemeta HTTP ${response.status}`);
        }

        const data = await response.json();

        return data.metas || [];
    } catch (error) {
        console.error("Chyba Cinemeta API:", error);
        return [];
    }
}

builder.defineCatalogHandler(async (args) => {

    if (
        args.type === "movie" &&
        args.id === "cinemeta_animation_movies"
    ) {
        const data = await ziskejCinemetaData("movie");

        return {
            metas: data
        };
    }

    if (
        args.type === "series" &&
        args.id === "cinemeta_animation_series"
    ) {
        const data = await ziskejCinemetaData("series");

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
