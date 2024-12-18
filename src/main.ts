import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts"; //Fixes missing marker images
import luck from "./luck.ts"; //Random number generator

//Interfaces
interface CacheMemento {
  [key: string]: { coinCount: number; coins: { serial: number }[] };
}

//Creating Constant Gameplay Variables
const playerDelta = 0.0001;
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const cacheStorage: {
  [key: string]: { coinCount: number; coins: { serial: number }[] };
} = {};
let playerCoins = 0;

//Creating Initial Location, Map, and Player
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("YOU");
playerMarker.addTo(map);

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Player Coins: 0";

//Creating Variables for Player Movement History
const initialPosition = playerMarker.getLatLng();
let playerPath: leaflet.LatLng[] = [initialPosition];
const moveHistoryPolyline = leaflet
  .polyline(playerPath, { color: "blue" })
  .addTo(map);

//GEOLOCATION TOGGLE
let geolocationWatchID: number | null = null;

//FUNCTIONS --------------------
function initializeGameConfig(): {
  gameConfig: {
    center: leaflet.LatLng;
    tileDegrees: number;
    spawnProbability: number;
    gameplayZoomLevel: number;
    rng: (luck: string) => number;
  };
  cacheFlyweightFactory: ReturnType<typeof createFlyweightFactory>;
} {
  const gameConfig = {
    center: OAKES_CLASSROOM,
    tileDegrees: TILE_DEGREES,
    spawnProbability: CACHE_SPAWN_PROBABILITY,
    gameplayZoomLevel: GAMEPLAY_ZOOM_LEVEL,
    rng: luck,
  };

  const cacheFlyweightFactory = createFlyweightFactory(gameConfig);

  return { gameConfig, cacheFlyweightFactory };
}

function initializeEventListeners(
  gameConfig: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (key: string) => number;
  },
  cacheFlyweightFactory: ReturnType<typeof createFlyweightFactory>,
): void {
  addMovementButtonsFunctionality(gameConfig, cacheFlyweightFactory);
  addGeoLocationButton(gameConfig, cacheFlyweightFactory);
  addResetButton();
}

function initializeCaches(
  playerLat: number,
  playerLong: number,
  gameConfig: {
    center: leaflet.LatLng;
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (key: string) => number;
  },
  cacheFlyweightFactory: ReturnType<typeof createFlyweightFactory>,
): void {
  generateCaches(gameConfig, cacheFlyweightFactory);
  updateVisibleCaches(playerLat, playerLong, gameConfig, cacheFlyweightFactory);
}

function restoreGameState(
  gameConfig: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (key: string) => number;
  },
  cacheFlyweightFactory: ReturnType<typeof createFlyweightFactory>,
): void {
  loadGameState(gameConfig, cacheFlyweightFactory);
}

function startGame(): void {
  const { gameConfig, cacheFlyweightFactory } = initializeGameConfig();
  initializeEventListeners(gameConfig, cacheFlyweightFactory);
  initializeCaches(
    playerMarker.getLatLng().lat,
    playerMarker.getLatLng().lng,
    gameConfig,
    cacheFlyweightFactory,
  );
  restoreGameState(gameConfig, cacheFlyweightFactory);
}

function createFlyweightFactory(config: {
  tileDegrees: number;
  spawnProbability: number;
}): {
  calculateBounds: (
    latBase: number,
    longBase: number,
    i: number,
    j: number,
  ) => leaflet.LatLngBounds | null;
  shouldSpawnCache: (i: number, j: number) => boolean;
} {
  function calculateBounds(
    latBase: number,
    longBase: number,
    i: number,
    j: number,
  ): leaflet.LatLngBounds | null {
    const lat1 = latBase + i * config.tileDegrees;
    const lat2 = latBase + (i + 1) * config.tileDegrees;
    const long1 = longBase + j * config.tileDegrees;
    const long2 = longBase + (j + 1) * config.tileDegrees;

    const bounds = leaflet.latLngBounds([
      [lat1, long1],
      [lat2, long2],
    ]);

    return bounds;
  }

  function shouldSpawnCache(i: number, j: number): boolean {
    return luck([i, j].toString()) < config.spawnProbability;
  }

  return { calculateBounds, shouldSpawnCache };
}

function addMovementButtonsFunctionality(
  config: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (luck: string) => number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  document
    .querySelector("#north")
    ?.addEventListener(
      "click",
      () => movePlayer(0, playerDelta, config, cacheFlyweightFactory),
    );
  document
    .querySelector("#south")
    ?.addEventListener(
      "click",
      () => movePlayer(0, -playerDelta, config, cacheFlyweightFactory),
    );
  document
    .querySelector("#east")
    ?.addEventListener(
      "click",
      () => movePlayer(playerDelta, 0, config, cacheFlyweightFactory),
    );
  document
    .querySelector("#west")
    ?.addEventListener(
      "click",
      () => movePlayer(-playerDelta, 0, config, cacheFlyweightFactory),
    );
}

function addGeoLocationButton(
  config: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (luck: string) => number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  const sensorButton = document.getElementById("sensor");
  if (sensorButton) {
    sensorButton.addEventListener("click", () => {
      if (geolocationWatchID !== null) {
        navigator.geolocation.clearWatch(geolocationWatchID);
        geolocationWatchID = null;
      } else {
        if (navigator.geolocation) {
          geolocationWatchID = navigator.geolocation.watchPosition(
            (position) => {
              movePlayerToPosition(
                position.coords.latitude,
                position.coords.longitude,
                config,
                cacheFlyweightFactory,
              );
            },
            (error) => console.error("Error watching geolocation", error),
            { enableHighAccuracy: true },
          );
        } else {
          console.log("Geolocation Not Supported");
        }
      }
    });
  }
}

function addResetButton(): void {
  document.getElementById("reset")!.addEventListener("click", resetGameState);
}

function initializePath(initialPosition: leaflet.LatLng): void {
  playerPath = [initialPosition];
  moveHistoryPolyline.setLatLngs(playerPath);
}

function movePlayer(
  deltaLong: number,
  deltaLat: number,
  config: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (luck: string) => number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  const currentLatLong = playerMarker.getLatLng();
  const newLat = currentLatLong.lat + deltaLat;
  const newLong = currentLatLong.lng + deltaLong;

  createCacheMemento(); //Saving Current Cache State

  playerPath.push([newLat, newLong]);
  moveHistoryPolyline.setLatLngs(playerPath);

  playerMarker.setLatLng([newLat, newLong]);
  updateVisibleCaches(newLat, newLong, config, cacheFlyweightFactory);
}

function movePlayerToPosition(
  lat: number,
  long: number,
  config: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (luck: string) => number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  playerPath.push([lat, long]);
  moveHistoryPolyline.setLatLngs(playerPath);

  playerMarker.setLatLng([lat, long]);
  updateVisibleCaches(lat, long, config, cacheFlyweightFactory);
}

function ensureCacheExists(
  lat: number,
  long: number,
  config: { rng: (key: string) => number },
): { gridPosition: { i: number; j: number }; cacheKey: string } {
  const gridPosition = convertToGrid(lat, long);
  const cacheKey = `${gridPosition.i},${gridPosition.j}`;

  if (!cacheStorage[cacheKey]) {
    const initialCoinCount = Math.floor(
      config.rng([gridPosition.i, gridPosition.j, "initialValue"].toString()) *
        10,
    );
    cacheStorage[cacheKey] = { coinCount: initialCoinCount, coins: [] };
    for (let n = 0; n < initialCoinCount; n++) {
      cacheStorage[cacheKey].coins.push({ serial: n });
    }
  }

  return { gridPosition, cacheKey };
}

function createPopUpForCache(
  cacheKey: string,
  gridPosition: { i: number; j: number },
  bounds: leaflet.latLngBounds,
): HTMLElement {
  const cache = cacheStorage[cacheKey];
  let coinCount = cache.coinCount;

  const onCoinIdentifierClick = (e: MouseEvent) => {
    e.preventDefault();
    map.setView(bounds.getCenter(), GAMEPLAY_ZOOM_LEVEL);
  };

  const updateCoinRepresentation = () => {
    return cache.coins
      .map(
        (coin) =>
          `<a href="#" class="coin-link" data-key="${cacheKey}">${gridPosition.i}:${gridPosition.j}#${coin.serial}</a>`,
      )
      .join(", ");
  };

  const popUpDiv = document.createElement("div");
  popUpDiv.innerHTML =
    `<div>Cache at <strong>"${gridPosition.i}, ${gridPosition.j}"</strong>. <strong><br>Coins: </strong><span id="value">${coinCount}</span>.
    <strong><br><br>Coin Identifiers: </strong><br><span id="coinRepresentation">${updateCoinRepresentation()}</span></div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;
  popUpDiv.querySelectorAll<HTMLAnchorElement>(".coin-link").forEach((link) => {
    link.addEventListener("click", onCoinIdentifierClick);
  });
  popUpDiv
    .querySelector<HTMLButtonElement>("#collect")!
    .addEventListener("click", () => {
      if (coinCount > 0) {
        coinCount -= 1;
        cache.coins.pop();
        popUpDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = coinCount
          .toString();
        popUpDiv.querySelector<HTMLSpanElement>(
          "#coinRepresentation",
        )!.innerHTML = updateCoinRepresentation();
        playerCoins += 1;
        updatePlayerCacheStats(cacheKey, coinCount);
      }
    });
  popUpDiv
    .querySelector<HTMLButtonElement>("#deposit")!
    .addEventListener("click", () => {
      if (playerCoins > 0) {
        coinCount += 1;
        playerCoins -= 1;
        const newSerialValue = cache.coins.length > 0
          ? cache.coins[cache.coins.length - 1].serial + 1
          : 0;
        cache.coins.push({ serial: newSerialValue });
        popUpDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = coinCount
          .toString();
        popUpDiv.querySelector<HTMLSpanElement>(
          "#coinRepresentation",
        )!.innerHTML = updateCoinRepresentation();
        updatePlayerCacheStats(cacheKey, coinCount);
      }
    });

  return popUpDiv;
}

function spawnCache(
  lat: number,
  long: number,
  config: {
    rng: (key: string) => number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  const { gridPosition, cacheKey } = ensureCacheExists(lat, long, config);

  const bounds = cacheFlyweightFactory.calculateBounds(lat, long, 0, 0);
  if (bounds == null) {
    return;
  }

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  const popup = createPopUpForCache(cacheKey, gridPosition, bounds);
  rect.bindPopup(popup);
}

function updatePlayerCacheStats(cacheKey: string, coinCount: number): void {
  cacheStorage[cacheKey].coinCount = coinCount;
  statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
}

function updatePlayerStatus(): void {
  statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
}

function clearMapLayers(map: leaflet.Map): void {
  map.eachLayer(function (layer: leaflet.Layer) {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });
}

function calculateVisibleGrid(
  playerLat: number,
  playerLong: number,
  config: { tileDegrees: number },
): {
  gridBaseLat: number;
  gridBaseLong: number;
  northBound: number;
  southBound: number;
  eastBound: number;
  westBound: number;
} {
  const boundOffset = NEIGHBORHOOD_SIZE * config.tileDegrees;
  const northBound = playerLat + boundOffset;
  const southBound = playerLat - boundOffset;
  const eastBound = playerLong + boundOffset;
  const westBound = playerLong - boundOffset;

  const gridBaseLat = Math.round(
    (playerLat - OAKES_CLASSROOM.lat) / config.tileDegrees,
  );
  const gridBaseLong = Math.round(
    (playerLong - OAKES_CLASSROOM.lng) / config.tileDegrees,
  );

  return {
    gridBaseLat,
    gridBaseLong,
    northBound,
    southBound,
    eastBound,
    westBound,
  };
}

function addCacheToMap(
  cacheKey: string,
  cache: { coinCount: number },
  bounds: leaflet.LatLngBounds,
): void {
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  rect.bindPopup(() => {
    return `<div>Cache at <strong>${cacheKey}</strong>. Coins: ${cache.coinCount}.</div>`;
  });
}

function updateVisibleCaches(
  playerLat: number,
  playerLong: number,
  config: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (key: string) => number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  clearMapLayers(map);
  const {
    gridBaseLat,
    gridBaseLong,
    northBound,
    southBound,
    eastBound,
    westBound,
  } = calculateVisibleGrid(playerLat, playerLong, config);

  for (
    let i = gridBaseLat - NEIGHBORHOOD_SIZE;
    i <= gridBaseLat + NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = gridBaseLong - NEIGHBORHOOD_SIZE;
      j <= gridBaseLong + NEIGHBORHOOD_SIZE;
      j++
    ) {
      const lat = OAKES_CLASSROOM.lat + i * config.tileDegrees;
      const long = OAKES_CLASSROOM.lng + j * config.tileDegrees;
      const cacheKey = `${i},${j}`;
      if (
        !cacheStorage[cacheKey] &&
        cacheFlyweightFactory.shouldSpawnCache(i, j)
      ) {
        spawnCache(lat, long, config, cacheFlyweightFactory);
      }

      if (
        lat <= northBound &&
        lat >= southBound &&
        long <= eastBound &&
        long >= westBound
      ) {
        const cache = cacheStorage[cacheKey];
        if (cache) {
          const bounds = cacheFlyweightFactory.calculateBounds(lat, long, 0, 0);
          if (bounds) {
            addCacheToMap(cacheKey, cache, bounds);
          }
        }
      }
    }
  }
}

function generateCaches(
  config: {
    center: leaflet.LatLng;
    tileDegrees: number;
    rng: (key: string) => number;
    gameplayZoomLevel: number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  const baseLat = config.center.lat;
  const baseLong = config.center.lng;

  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      const lat = baseLat + i * config.tileDegrees;
      const long = baseLong + j * config.tileDegrees;
      if (cacheFlyweightFactory.shouldSpawnCache(i, j)) {
        spawnCache(lat, long, config, cacheFlyweightFactory);
      }
    }
  }
}

function convertToGrid(lat: number, long: number) {
  const scaleFactor = 10000;
  const i = Math.floor(lat * scaleFactor);
  const j = Math.floor(long * scaleFactor);
  return { i, j };
}

function createCacheMemento() {
  return JSON.parse(JSON.stringify(cacheStorage));
}

function saveGameState(): void {
  const gameState = {
    cacheStorage,
    playerPosition: playerMarker.getLatLng(),
    playerCoins,
  };
  localStorage.setItem("gameState", JSON.stringify(gameState));
}

function loadGameState(
  config: {
    tileDegrees: number;
    gameplayZoomLevel: number;
    rng: (luck: string) => number;
  },
  cacheFlyweightFactory: {
    calculateBounds: (
      latBase: number,
      longBase: number,
      i: number,
      j: number,
    ) => leaflet.LatLngBounds | null;
    shouldSpawnCache: (i: number, j: number) => boolean;
  },
): void {
  const gameStateString = localStorage.getItem("gameState");
  if (gameStateString) {
    try {
      const gameState = JSON.parse(gameStateString);
      Object.assign(cacheStorage, gameState.cacheStorage);
      playerCoins = gameState.playerCoins;
      const playerPosition = gameState.playerPosition;
      playerMarker.setLatLng([playerPosition.lat, playerPosition.lng]);
      initializePath(playerMarker.getLatLng());
      updateVisibleCaches(
        playerPosition.lat,
        playerPosition.lng,
        config,
        cacheFlyweightFactory,
      );
      updatePlayerStatus();
    } catch (error) {
      console.error("Failed to load game state:", error);
    }
  }
}

function resetGameState(): void {
  const playerConfirmation: string | null = prompt(
    "Are you sure you would like to reset the game state? Type 'YES' to confirm.",
  );
  if (playerConfirmation === "YES") {
    Object.keys(cacheStorage).forEach((key) => {
      const cache = cacheStorage[key];
      cache.coins.length = 0;
      cache.coinCount = Math.floor(luck(key.split(",").toString()) * 10);
      for (let n = 0; n < cache.coinCount; n++) {
        cache.coins.push({ serial: n });
      }
    });

    playerCoins = 0;
    updatePlayerStatus();

    playerPath = [playerMarker.getLatLng()];
    moveHistoryPolyline.setLatLngs(playerPath);

    localStorage.removeItem("gameState");
  }
}

// MAIN FUNCTION CALLS
startGame();

//WINDOW FUNCTIONS
globalThis.addEventListener("beforeunload", saveGameState);
