import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts"; //Fixes missing marker images
import luck from "./luck.ts"; //Random number generator

//Creating Constant Gameplay Variables
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

//FLYWEIGHT PATTERN
const cacheFlyweightFactory = (() => {
  const cacheProperties = {
    tileDegrees: TILE_DEGREES,
    spawnProbability: CACHE_SPAWN_PROBABILITY,
  };

  function calculateBounds(
    latBase: number,
    longBase: number,
    i: number,
    j: number,
  ) {
    const lat1 = latBase + i * cacheProperties.tileDegrees;
    const lat2 = latBase + (i + 1) * cacheProperties.tileDegrees;
    const long1 = longBase + j * cacheProperties.tileDegrees;
    const long2 = longBase + (j + 1) * cacheProperties.tileDegrees;

    const bounds = leaflet.latLngBounds([
      [lat1, long1],
      [lat2, long2],
    ]);

    return bounds;
  }

  function shouldSpawnCache(i: number, j: number): boolean {
    return luck([i, j].toString()) < cacheProperties.spawnProbability;
  }

  return { calculateBounds, shouldSpawnCache };
})();

//FUNCTIONS --------------------
function spawnCache(lat: number, long: number) {
  const gridPosition = convertToGrid(lat, long);
  const cacheKey = `${gridPosition.i},${gridPosition.j}`;

  if (!cacheStorage[cacheKey]) {
    const initialCoinCount = Math.floor(
      luck([gridPosition.i, gridPosition.j, "initialValue"].toString()) * 10,
    );
    cacheStorage[cacheKey] = { coinCount: initialCoinCount, coins: [] };
    for (let n = 0; n < initialCoinCount; n++) {
      cacheStorage[cacheKey].coins.push({ serial: n });
    }
  }

  const bounds = cacheFlyweightFactory.calculateBounds(lat, long, 0, 0);
  if (bounds == null) {
    return;
  }

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => {
    const cache = cacheStorage[cacheKey];
    let coinCount = cache.coinCount;

    const updateCoinRepresentation = () => {
      return cache.coins
        .map((coin) => `${gridPosition.i}:${gridPosition.j}#${coin.serial}`)
        .join(", ");
    };

    const popUpDiv = document.createElement("div");
    popUpDiv.innerHTML =
      `<div>Cache at <strong>"${gridPosition.i}, ${gridPosition.j}"</strong>. <strong><br>Coins: </strong><span id="value">${coinCount}</span>.
    <strong><br><br>Coin Identifiers: </strong><br><span id="coinRepresentation">${updateCoinRepresentation()}</span></div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;
    popUpDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (coinCount > 0) {
          coinCount -= 1;
          const collectedCoin = cache.coins.pop();
          popUpDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinCount.toString();
          popUpDiv.querySelector<HTMLSpanElement>(
            "#coinRepresentation",
          )!.innerHTML = updateCoinRepresentation();
          playerCoins += 1;
          updatePlayerCacheStats(cacheKey, coinCount);
          console.log(
            `Collected coin: ${gridPosition.i}:${gridPosition.j}#${collectedCoin?.serial}`,
          );
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
          popUpDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinCount.toString();
          popUpDiv.querySelector<HTMLSpanElement>(
            "#coinRepresentation",
          )!.innerHTML = updateCoinRepresentation();
          updatePlayerCacheStats(cacheKey, coinCount);
          console.log(
            `Deposited coin: ${gridPosition.i}:${gridPosition.j}#${newSerialValue}`,
          );
        }
      });

    return popUpDiv;
  });
}

function updatePlayerCacheStats(cacheKey: string, coinCount: number): void {
  cacheStorage[cacheKey].coinCount = coinCount;
  statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
}

function generateCaches(): void {
  const baseLat = OAKES_CLASSROOM.lat;
  const baseLong = OAKES_CLASSROOM.lng;

  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      if (cacheFlyweightFactory.shouldSpawnCache(i, j)) {
        const lat = baseLat + i * TILE_DEGREES;
        const long = baseLong + j * TILE_DEGREES;
        spawnCache(lat, long);
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

//MAIN FUNCTION CALLS
generateCaches();
