# LinkVault

A browser extension for saving, copying, and autofilling professional and personal profile links.

## Features

- Save, edit, and delete profile links.
- Add optional aliases to improve field matching.
- Copy saved links from the browser popup.
- Detect matching profile URL fields when they receive focus.
- Show a compact floating suggestion panel inside the webpage.
- Fill a selected field with one click.
- Recheck saved profiles when local profile data changes.
- Support standard inputs and textareas, including dynamically inserted fields when focused.
- Import and export JSON backups.
- Keep profile data in `chrome.storage.local`.

## Supported browsers

- Google Chrome
- Brave Browser

Both browsers support the Chromium Manifest V3 extension APIs used by LinkVault.

## Installation

1. Download and extract the LinkVault project.
2. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the `LinkVault` folder containing `manifest.json`.
6. Pin LinkVault from the browser extensions menu for quick access.

## How to use

1. Open the LinkVault extension popup.
2. Select **Manage profiles**.
3. Add a profile name and an HTTP or HTTPS URL.
4. Optionally add comma-separated aliases such as `GitHub profile, code hosting`.
5. Save the profile.
6. Visit a webpage and focus a field whose label or identifying text describes that profile.
7. Choose the matching suggestion in the LinkVault panel to fill the field.

LinkVault never submits a form.

## Smart autofill

LinkVault examines field attributes such as `name`, `id`, `placeholder`, `aria-label`, `title`, `autocomplete`, associated labels, and nearby text. It compares those details with saved profile names and aliases using phrase and token scoring.

Suggestions are displayed only when the match reaches a confidence threshold. This intentionally favors avoiding unrelated suggestions over showing a suggestion for every generic URL field.

The panel is rendered in a Shadow DOM to reduce interference from website styles. It is repositioned on scroll and window resize. The content script runs in matching frames where browser permissions allow it.

### Known limitations

- A field with only a generic label such as `Website` may not identify which of several saved profile links is appropriate.
- Closed Shadow DOM components cannot be inspected by ordinary page scripts.
- Browser-internal pages, extension stores, and other restricted pages do not permit normal content-script injection.
- Some complex custom controls are not ordinary input or textarea elements and are not supported.
- Cross-origin frames may be restricted by the browser or the website's embedding configuration.
- Framework-controlled forms generally respond to native value setters and bubbling input/change events, but individual sites may implement additional custom behavior.

## Project structure

```text
LinkVault/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── styles.css
├── README.md
└── .gitignore
```

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Store profile names, URLs, and aliases locally. |
| `contextMenus` | Provide a right-click action to request LinkVault suggestions. |
| `<all_urls>` host access | Allow the content script to detect matching fields on websites. |

The broad host access is used because profile fields can appear on many unrelated websites. Users can review and change extension site access in their browser settings, but restricting access can prevent autofill on sites that are not permitted.

## Privacy

Profile information is stored using `chrome.storage.local`. This project does not include a backend service or code that sends saved profile URLs to a remote server. The extension does not store passwords and does not submit forms.

Anyone distributing a modified build should review its permissions and data flows before making privacy statements about that build.

## Troubleshooting

### No suggestion appears

- Confirm the relevant profile is saved in LinkVault.
- Confirm the browser allows LinkVault to access the current website.
- Refresh the webpage after changing site access or reloading the extension.
- Focus the actual input or textarea, not only its surrounding label.
- Add a specific alias that matches the wording used by the website.
- Check the field is not disabled, read-only, or a password field.

### The extension does not run on a page

Some browser pages and extension-store pages restrict content scripts. Check the browser's extension site-access settings for ordinary websites.

### Changes are not visible

Open the extensions page, reload LinkVault, and refresh the webpage being tested.

## Development

LinkVault uses plain HTML, CSS, and JavaScript with Manifest V3. No build step or package installation is required.

After changing extension files:

1. Open the browser extensions page.
2. Reload LinkVault.
3. Refresh the website under test.
4. Inspect the extension's service worker and the webpage console if errors occur.

## Testing status

The source package has been reviewed and the JavaScript files should be syntax-checked before release. Real browser installation, Chrome/Brave compatibility, live website autofill, React forms, and clipboard behavior still require hands-on testing. Do not treat packaging as proof of those tests.

## License

No license has been selected. Add a license file only after choosing the terms under which the project will be distributed.
