"use strict";

const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

// ---------------------------------------------------------------------------
// Nastavení
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 7000;
const CINEMETA = "https://v3-cinemeta.strem.io";
const GENRE = "Animation";

const REQUEST_TIMEOUT_MS = 10000; // max doba čekání na Cinemetu
const RETRIES = 2;                // kolik dalších pokusů při chybě
const CACHE_TTL_MS = 30 * 60000;  // 30 minut
const CACHE_MAX_ITEMS = 500;      // ochrana paměti

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
// "skip" nesmí mít pevný seznam options. Stremio si skip počítá samo.
const manifest = {
    id: "cz.flyerscze.animace",
    version: "2.1.0",
    name: "🎬 Animace (Filmy + Seriály)",
    description: "Populární animované filmy a seriály z Cinemety s neomezeným stránkováním.",
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
            type: "series",
            id: "animace_serialy_top",
            name: "📺 Animované seriály: Populární",
            extra: [{ name: "skip" }]
        }
    ]
};

const CATALOG_MAP = {
    animace_filmy_top:   { type: "movie",  sort: "top" },
    animace_serialy_top: { type: "series", sort: "top" }
};

// ---------------------------------------------------------------------------
// Cache v paměti (se "stale" fallbackem při výpadku Cinemety)
// ---------------------------------------------------------------------------
const cache = new Map(); // klíč -> { time, metas }

function cacheGet(key) {
    return cache.get(key) || null;
}

function cacheSet(key, metas) {
    if (cache.size >= CACHE_MAX_ITEMS) {
        cache.delete(cache.keys().next().value);
    }
    cache.set(key, { time: Date.now(), metas });
}

// ---------------------------------------------------------------------------
// Pomocné funkce
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Vrací seznam URL k vyzkoušení (první je hlavní, druhé záložní pořadí parametrů)
function buildUrls(type, sort, skip) {
    if (skip <= 0) {
        return [`${CINEMETA}/catalog/${type}/${sort}/genre=${GENRE}.json`];
    }
    return [
        `${CINEMETA}/catalog/${type}/${sort}/genre=${GENRE}&skip=${skip}.json`,
        `${CINEMETA}/catalog/${type}/${sort}/skip=${skip}&genre=${GENRE}.json`
    ];
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
function cleanMetas(metas) {
    const seen = new Set();
    return metas.filter((m) => {
        if (!m || !m.id || !m.name) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });
}

async function fetchWithRetry(url) {
    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        try {
            const data = await fetchJson(url);
            return cleanMetas(Array.isArray(data.metas) ? data.metas : []);
        } catch (error) {
            lastError = error;
            console.warn(`[CHYBA] ${url} (pokus ${attempt + 1}/${RETRIES + 1}): ${error.message}`);
            if (attempt < RETRIES) await sleep(500 * (attempt + 1));
        }
    }
    throw lastError;
}

async function loadCatalog(type, sort, skip) {
    const cacheKey = `${type}/${sort}/${skip}`;
    const cached = cacheGet(cacheKey);

    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        return cached.metas;
    }

    const urls = buildUrls(type, sort, skip);
    let failed = false;

    for (const url of urls) {
        try {
            const metas = await fetchWithRetry(url);
            console.log(`[OK] ${type}/${sort} skip=${skip} -> ${metas.length} položek`);
            if (metas.length > 0) {
                cacheSet(cacheKey, metas);
                return metas;
            }
            // prázdná odpověď -> zkus další variantu URL
        } catch (error) {
            failed = true;
            console.error(`[SELHÁNÍ] ${url}: ${error.message}`);
        }
    }

    // Cinemeta nedostupná -> použij starou cache, pokud existuje
    if (failed && cached) {
        console.warn(`[CACHE] Používám starší data pro ${cacheKey}`);
        return cached.metas;
    }

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
        cacheMaxAge: 60 * 60,
        staleRevalidate: 24 * 60 * 60,
        staleError: 7 * 24 * 60 * 60
    };
});

// ---------------------------------------------------------------------------
// Start serveru
// ---------------------------------------------------------------------------
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Doplněk běží na http://localhost:${PORT}/manifest.json`);
