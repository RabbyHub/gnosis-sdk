const fs = require("fs/promises");
const path = require("path");
const https = require("https");

const SAFE_TX_SERVICE_NETWORKS_URL =
  "https://raw.githubusercontent.com/safe-global/safe-docs/main/components/ApiReference/tx-service-networks.json";
const DEBANK_SUPPORTED_CHAINS_URL =
  "https://static.debank.com/supported_chains.json";
const OUTPUT_PATH = path.resolve(__dirname, "../src/chains/networks.json");

const chainServerIdEnumMap = {
  eth: "ETH",
  bsc: "BSC",
  xdai: "GNOSIS",
  matic: "POLYGON",
  ftm: "FTM",
  okt: "OKT",
  heco: "HECO",
  avax: "AVAX",
  arb: "ARBITRUM",
  op: "OP",
  celo: "CELO",
  movr: "MOVR",
  cro: "CRO",
  boba: "BOBA",
  metis: "METIS",
  btt: "BTT",
  aurora: "AURORA",
  mobm: "MOBM",
  sbch: "SBCH",
  hmy: "HMY",
  fuse: "FUSE",
  astar: "ASTAR",
  klay: "KLAY",
  rsk: "RSK",
  iotx: "IOTX",
  kcc: "KCC",
  wan: "WAN",
  sgb: "SGB",
  evmos: "EVMOS",
  dfk: "DFK",
  tlos: "TLOS",
  nova: "NOVA",
  canto: "CANTO",
  doge: "DOGE",
  step: "STEP",
  kava: "KAVA",
  mada: "MADA",
  cfx: "CFX",
  brise: "BRISE",
  ckb: "CKB",
  tomb: "TOMB",
  pze: "PZE",
  era: "ERA",
  eos: "EOS",
  core: "CORE",
  flr: "FLR",
  wemix: "WEMIX",
  mtr: "METER",
  etc: "ETC",
  fsn: "FSN",
  pls: "PULSE",
  rose: "ROSE",
  ron: "RONIN",
  oas: "OAS",
  zora: "ZORA",
  linea: "LINEA",
  base: "BASE",
  mnt: "MANTLE",
  tenet: "TENET",
  lyx: "LYX",
  opbnb: "OPBNB",
  loot: "LOOT",
  shib: "SHIB",
  manta: "MANTA",
  scrl: "SCRL",
  fx: "FX",
  beam: "BEAM",
  pego: "PEGO",
  zkfair: "ZKFAIR",
  fon: "FON",
  bfc: "BFC",
  alot: "ALOT",
  xai: "XAI",
  zeta: "ZETA",
  rari: "RARI",
  hubble: "HUBBLE",
  mode: "MODE",
  merlin: "MERLIN",
  dym: "DYM",
  eon: "EON",
  blast: "BLAST",
  sx: "SX",
  platon: "PLATON",
  map: "MAP",
  frax: "FRAX",
  aze: "AZE",
  karak: "KARAK",
};

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          fetchJson(new URL(response.headers.location, url).toString())
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`));
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });

const readExistingNetworks = async () => {
  try {
    return JSON.parse(await fs.readFile(OUTPUT_PATH, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const toChainEnum = (debankChain) => {
  if (!debankChain) {
    return undefined;
  }

  return chainServerIdEnumMap[debankChain.id] || debankChain.id.toUpperCase();
};

const getTxServiceShortName = ({ shortName, txServiceUrl }) => {
  const txServiceUrlShortName = txServiceUrl?.split("/").filter(Boolean).pop();
  return txServiceUrlShortName || shortName;
};

const getMappedChainEnum = (serverId) => chainServerIdEnumMap[serverId];

const main = async () => {
  const existingNetworks = await readExistingNetworks();
  const [safeNetworks, debankChains] = await Promise.all([
    fetchJson(SAFE_TX_SERVICE_NETWORKS_URL),
    fetchJson(DEBANK_SUPPORTED_CHAINS_URL),
  ]);

  const debankChainByCommunityId = new Map(
    debankChains.map((chain) => [String(chain.community_id), chain]),
  );

  const networks = safeNetworks.map((safeNetwork) => {
    const { chainId, shortName } = safeNetwork;
    const txServiceShortName = getTxServiceShortName(safeNetwork);
    const enumName =
      toChainEnum(debankChainByCommunityId.get(String(chainId))) ||
      getMappedChainEnum(shortName) ||
      getMappedChainEnum(txServiceShortName);
    return {
      chainId: String(chainId),
      shortName: txServiceShortName,
      ...(enumName ? { enum: enumName } : {}),
    };
  });

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(networks, null, 2)}\n`);

  const enumCount = networks.filter((network) => network.enum).length;
  const existingEnums = new Set(
    existingNetworks.map((network) => network.enum).filter(Boolean),
  );
  const newEnums = networks
    .map((network) => network.enum)
    .filter((enumName) => enumName && !existingEnums.has(enumName));

  console.log(
    `Updated ${path.relative(process.cwd(), OUTPUT_PATH)} with ${
      networks.length
    } networks (${enumCount} with enum).`,
  );
  console.log(
    `New enums: ${newEnums.length > 0 ? newEnums.join(", ") : "none"}.`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
