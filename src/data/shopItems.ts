/**
 * Shop catalogue — edited manually, right here in code. There is no admin UI for
 * this on purpose: to add, change, or remove something for sale, just edit the
 * SHOP_ITEMS array below and redeploy.
 *
 * Fields:
 *  - id:          any unique short string (used as the React key)
 *  - name:        product/service title shown on the card
 *  - description: 1–2 sentence blurb
 *  - price:       a plain display string, e.g. "Rs. 1500" or "$12" — not parsed, so
 *                 format it however you like
 *  - imageUrl:    optional image (leave "" to show a placeholder icon instead)
 *  - buyUrl:      where the "Buy Now" button sends the student — a WhatsApp link,
 *                 a payment link, a Google Form, etc.
 *  - badge:       optional small label, e.g. "New", "Bestseller", "Limited"
 */
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
  buyUrl: string;
  badge?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // Example — replace or delete this, then add your own items below.
  // {
  //   id: "block3-notes",
  //   name: "Block III High-Yield Notes (PDF)",
  //   description: "Condensed Cardiovascular & Respiratory notes with diagrams.",
  //   price: "Rs. 500",
  //   imageUrl: "",
  //   buyUrl: "https://wa.me/923000000000?text=I%20want%20to%20buy%20Block%20III%20Notes",
  //   badge: "Bestseller",
  // },
];
