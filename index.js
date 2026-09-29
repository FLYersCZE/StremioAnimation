"use strict";

const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

// ---------------------------------------------------------------------------
// Nastavení
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 7000;
const CINEMETA = "https://v3-cinemeta.strem.io";
const GENRE = "Animation";

const REQUEST_TIMEOUT_MS = 10_000; // max doba čekání na Cinemetu
const RETRIES = 2;                 // kolik dalších pokusů při chybě
const CACHE_TTL_MS = 30 * 60_000;  // po jak dlouhé době se data berou jako "stará"
const CACHE_MAX_ITEMS = 500;       // ochrana paměti

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
// DŮLEŽITÉ: "skip" nesmí mít pevný seznam options. Stremio si skip počítá samo
// podle počtu už načtených položek a posílá ho dokud katalog vrací data.
const manifest = {
    id: "cz.flyerscze.animace",
    version: "2.0.0",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Populární a nejnovější animované filmy a seriály z Cinemety s neomezeným stránkováním.",
    resources: ["catalog"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: [
        {
            type: "movie",
            id: "animace_filmy_top",
            name: "🧸 Animované filmy: Populární",
            extra: [{ name: "skip" }]
        },
        {
            type: "movie",
            id: "animace_filmy_novinky",
            name: "🆕 Animované filmy: Nejnovější",
            extra: [{ name: "skip" }]
        },
        {
            type: "series",
            id: "animace_serialy_top",
            name: "📺 Animované seriály: Populární",
            extra: [{ name: "skip" }]
        },
        {
            type: "series",
            id: "animace_serialy_novinky",
            name: "🆕 Animované seriály: Nejnovější",
            extra: [{ name: "skip" }]
        }
    ]
};

// Mapování ID katalogu -> typ a řazení v Cinemetě ("top" = populární, "year" = nejnovější)
const CATALOG_MAP = {
    animace_filmy_top:       { type: "movie",  sort: "top"  },
    animace_filmy_novinky:   { type: "movie",  sort: "year" },
    animace_serialy_top:     { type: "series", sort: "top"  },
    animace_serialy_novinky: { type: "series", sort: "year" }
};

// ---------------------------------------------------------------------------
// Jednoduchá cache v paměti (i s "stale" fallbackem při výpadku Cinemety)
// ---------------------------------------------------------------------------
const cache = new Map(); // url -> { time, metas }

function cacheGet(url) {
    return cache.get(url) || null;
}

function cacheSet(url, metas) {
    if (cache.size >= CACHE_MAX_ITEMS) {
        // smaž nejstarší záznam
        cache.delete(cache.keys().next().value);
    }
    cache.set(url, { time: Date.now(), metas });
}

// ---------------------------------------------------------------------------
// Pomocné funkce
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildUrl(type, sort, skip) {
    // Extra parametry se v protokolu Stremio spojují přes "&" v jedné části cesty
    const extra = skip > 0
        ? `genre=${GENRE}&skip=${skip}`
        : `genre=${GENRE}`;
    return `${CINEMETA}/catalog/${type}/${sort}/${extra}.json`;
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

// Odstraní duplicity a neplatné položky v rámci jedné stránky.
// Stránky mezi sebou NEFILTRUJEME, aby seděl offset "skip".
function cleanMetas(metas) {
    const seen = new Set();
    return metas.filter((m) => {
        if (!m || !m.id || !m.name) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });
}

async function loadCatalog(type, sort, skip) {
    const url = buildUrl(type, sort, skip);
    const cached = cacheGet(url);

    // Čerstvá cache -> rovnou vrať
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        return cached.metas;
    }

    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        try {
            const data = await fetchJson(url);
            const metas = cleanMetas(Array.isArray(data.metas) ? data.metas : []);
            console.log(`[OK] ${type}/${sort} skip=${skip} -> ${metas.length} položek`);
            cacheSet(url, metas);
            return metas;
        } catch (error) {
            lastError = error;
            console.warn(`[CHYBA] ${url} (pokus ${attempt + 1}/${RETRIES + 1}): ${error.message}`);
            if (attempt < RETRIES) await sleep(500 * (attempt + 1));
        }
    }

    // Cinemeta nedostupná -> použij starou cache, pokud existuje
    if (cached) {
        console.warn(`[CACHE] Používám starší data pro ${url}`);
        return cached.metas;
    }

    console.error(`[SELHÁNÍ] ${url}: ${lastError && lastError.message}`);
    return [];
}

// ---------------------------------------------------------------------------
// Handler katalogu
// ---------------------------------------------------------------------------
const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id, extra }) => {
    const def = CATALOG_MAP[id];
    if (!def || def.type !== type) {
        return { metas: [] };
    }

    const skip = Math.max(0, parseInt(extra && extra.skip, 10) || 0);
    console.log(`Požadavek: ${id} skip=${skip}`);

    const metas = await loadCatalog(def.type, def.sort, skip);

    return {
        metas,
        cacheMaxAge: 60 * 60,            // 1 hodina
        staleRevalidate: 24 * 60 * 60,   // den
        staleError: 7 * 24 * 60 * 60     // týden při chybě
    };
});

// ---------------------------------------------------------------------------
// Start serveru
// ---------------------------------------------------------------------------
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Doplněk běží na http://localhost:${PORT}/manifest.json`);
