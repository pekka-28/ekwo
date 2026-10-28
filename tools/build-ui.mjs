// build-ui.mjs
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url), at = p => new URL(p, root), source = 'templates/ekwo/';
const config = JSON.parse(await readFile(at('ui/build.json'), 'utf8'));
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const content = (await readFile(at(config.contentFile), 'utf8')).trim(), dialogs = (await readFile(at(config.dialogsFile), 'utf8')).trim();
async function render(template, target, slots) { let text = await readFile(at(source + template), 'utf8'); text = text.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => { if (!(name in slots))
    throw Error('Missing template slot ' + name); return slots[name]; }); if (process.argv.includes('--check')) {
    if (await readFile(at(target), 'utf8') !== text)
        throw Error(target + ' differs from its template');
}
else
    await writeFile(at(target), text); }
await render('shell.html', 'index.html', { TITLE: escape(config.title), BRAND: config.brand, MARK: escape(config.mark), CSP: config.csp, APP_STYLES: config.styles, CONTENT: content, DIALOGS: dialogs, ACCOUNT_LINKS: config.accountLinks, APP_SCRIPTS: config.scripts });
await render('landing.html', 'sign-in.html', { TITLE: escape(config.title), BRAND: config.brand, MARK: escape(config.mark), CSP: config.csp, APP_STYLES: config.loginStyles, LOGIN_LOGO: config.loginLogo, LOGIN_FORM: (await readFile(at(config.loginFormFile), 'utf8')).trim(), APP_SCRIPTS: config.loginScripts });
await mkdir(at('fonts/'), { recursive: true });
for (const name of ['native.css', 'icons.js', 'shell.css', 'theme.js', 'navigation.js', 'mark.svg', 'fonts/inter.woff2', 'fonts/fraunces.woff2']) {
    if (process.argv.includes('--check')) {
        if (!(await readFile(at(source + name))).equals(await readFile(at(name))))
            throw Error(name + ' differs from template');
    }
    else
        await copyFile(at(source + name), at(name));
}
console.log(process.argv.includes('--check') ? 'PASS: generated interface matches its template' : 'Generated Ekwo shell and landing page');
