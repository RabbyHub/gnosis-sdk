import networks from "./txServiceNetworks.json";

type NetworkShortName = {
  shortName: string;
  chainId: string;
  enum?: string;
};

export const GNOSIS_SUPPORT_CHAINS = (networks as NetworkShortName[])
  .map((item) => item.enum)
  .filter((e): e is string => Boolean(e));

const networkMap = (networks as NetworkShortName[]).reduce<
  Record<string, string>
>((acc, { chainId, shortName }) => {
  acc[chainId] = shortName;
  return acc;
}, {});

export const HOST_MAP: Record<string, string> = {};

export const getTxServiceUrl = (chainId: string) => {
  const shortName = networkMap[chainId];
  if (shortName) {
    return `/v1/safe-tx-service/${shortName}/api`;
  }
  return HOST_MAP[chainId];
};
