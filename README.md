# PAYLOT website

This folder **is** the website. There is no build step: whatever is on the `main` branch is what people see at
**https://versusselfrebate.github.io/paylot/** (GitHub Pages updates about 1 minute after each change).

## Change the Telegram link or the rebate amount

Both live in one small file: **`js/config.js`**.

1. On GitHub, open the repo and click `js` → `config.js`.
2. Click the pencil icon (✏️ "Edit this file").
3. Change only the value between the quotes / the number:
   ```js
   export const TELEGRAM_URL = 'https://t.me/LINK-KAU';   // ← your Telegram link
   export const REBATE_PER_LOT = 14;                      // ← dollars per lot
   ```
4. Click **Commit changes…** → **Commit changes**.

Every "Join on Telegram" button and the calculator update automatically.

## Change text on the page

1. On GitHub, click `index.html`, then the pencil icon.
2. Use your browser's find (Ctrl+F / Cmd+F) to locate the sentence you want.
3. Edit only the words **between** the tags, e.g. `<p>`**change this**`</p>`. Do not delete `<` `>` symbols.
4. Click **Commit changes…** → **Commit changes**.

If something breaks, open the **History** of the file on GitHub and copy back the previous version.
