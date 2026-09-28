const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
    id: "org.cinemeta.animation.github",
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
            name: "🧸 Animovaný svět: Seriály"
        }
    ]
};

const builder = new addonBuilder(manifest);

async function ziskejCinemetaData(contentType) {
    const url = `https://strem.io{contentType}/top/genre=Animation.json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.metas || [];
    } catch (error) {
        console.error(`Chyba při stahování dat pro ${contentType}:`, error);
        return [];
    }
}

builder.defineCatalogHandler(async (args) => {
    if (args.type === "movie" && args.id === "cinemeta_animation_movies") {
        return { metas: await ziskejCinemetaData("movie") };
    }
    if (args.type === "series" && args.id === "cinemeta_animation_series") {
        return { metas: await ziskejCinemetaData("series") };
    }
    return { metas: [] };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });
console.log(`🚀 Doplněk běží na portu ${port}`);
