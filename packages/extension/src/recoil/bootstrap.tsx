import { atom, selector } from "recoil";
import { PublicKey } from "@solana/web3.js";
import {
  UI_RPC_METHOD_NAVIGATION_READ,
  UI_RPC_METHOD_NAVIGATION_ACTIVE_TAB_READ,
} from "../common";
import { getBackgroundClient } from "../background/client";
import { TABS } from "../background/backend";
import { fetchRecentTransactions } from "./recent-transactions";
import { anchorContext } from "./wallet";
import {
  splTokenRegistry,
  fetchTokens,
  fetchSplMetadata,
  fetchSplMetadataUri,
} from "./token";
import { fetchPriceData } from "./price-data";
import * as atoms from "./atoms";
import { TokenAccountWithKey } from "./types";

/**
 * Defines the initial app load fetch.
 */
export const bootstrap = atom<any>({
  key: "bootstrap",
  default: selector({
    key: "bootstrapSelector",
    get: async ({ get }: any) => {
      const tokenRegistry = get(splTokenRegistry);
      const { provider } = get(anchorContext);
      const activeWallet = get(atoms.activeWallet);
      const walletPublicKey = new PublicKey(activeWallet);

      //
      // Perform data fetch.
      //
      try {
        //
        // Fetch token data.
        //
        const { tokenAccountsMap, tokenMetadata, nftMetadata } =
          await provider.connection.customSplTokenAccounts(walletPublicKey);
        const splTokenAccounts = new Map<string, TokenAccountWithKey>(
          tokenAccountsMap
        );

        //
        // Fetch the price data.
        //
        const coingeckoData = await fetchPriceData(
          splTokenAccounts,
          tokenRegistry
        );

        //
        // Get the transaction data for the wallet's recent transactions.
        //
        const recentTransactions = await fetchRecentTransactions(
          walletPublicKey,
          provider
        );

        //
        // Get the recent blockhash for transaction construction.
        //
        const { blockhash } = await provider.connection.getLatestBlockhash();

        //
        // Done.
        //
        return {
          splTokenAccounts,
          splTokenMetadata: tokenMetadata,
          splNftMetadata: new Map(nftMetadata),
          coingeckoData,
          recentTransactions,
          recentBlockhash: blockhash,
          walletPublicKey,
        };
      } catch (err) {
        // TODO: show error notification.
        console.error(err);
      }
    },
  }),
});

// Version of bootstrap for very fast data on load. This shouldn't block the load
// in any discernable way and can be called on initial load, regardless of the app
// being locked or unlocked.
export const bootstrapFast = atom<any>({
  key: "bootstrapFast",
  default: null,
  effects: [
    ({ setSelf }) => {
      setSelf(
        (async () => {
          // Fetch all navigation state.
          const backgroundClient = getBackgroundClient();
          const tabs = await Promise.all(
            TABS.map((t) =>
              backgroundClient.request({
                method: UI_RPC_METHOD_NAVIGATION_READ,
                params: [t[0]],
              })
            )
          );
          const activeTab = await backgroundClient.request({
            method: UI_RPC_METHOD_NAVIGATION_ACTIVE_TAB_READ,
            params: [],
          });
          return {
            tabs,
            activeTab,
          };
        })()
      );
    },
  ],
});
