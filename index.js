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
    const catalogUrl =
        `https://v3-cinemeta.strem.io/catalog/${contentType}/top/genre=Animation.json`;

    try {
        const response = await fetch(catalogUrl);

        if (!response.ok) {
            throw new Error(`Cinemeta HTTP ${response.status}`);
        }

        const data = await response.json();
        const metas = data.metas || [];

        // Načteme podrobné informace o každém titulu,
        // protože země původu není spolehlivě dostupná
        // přímo v katalogovém náhledu.
        const vysledky = await Promise.all(
            metas.map(async (meta) => {
                try {
                    const detailUrl =
                        `https://v3-cinemeta.strem.io/meta/${contentType}/${meta.id}.json`;

                    const detailResponse = await fetch(detailUrl);

                    if (!detailResponse.ok) {
                        return meta;
                    }

                    const detailData = await detailResponse.json();
                    const detail = detailData.meta;

                    if (!detail) {
                        return meta;
                    }

                    const country = String(detail.country || "").toLowerCase();
                    const language = String(detail.language || "").toLowerCase();

                    const jeJaponsko =
                        country.includes("japan") ||
                        country.includes("japonsko") ||
                        country.includes("jp") ||
                        language.includes("japanese") ||
                        language.includes("japan");

                    if (jeJaponsko) {
                        return null;
                    }

                    return meta;

                } catch (error) {
                    // Když se detail nepodaří načíst,
                    // titul raději ponecháme.
                    return meta;
                }
            })
        );

        return vysledky.filter(meta => meta !== null);

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
