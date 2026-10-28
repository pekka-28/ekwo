// ekwo-bridge.js
// Appended inside the pinned bundle module by build-ekwo-view.ts.
// Native cG, QF, rI, gR, TR and renderer bodies are retained unchanged.
const lustreRoots = new WeakMap();
const lustreRoutes = new Map();
const nativeRouteAddress = YS;
YS = route => lustreRoutes.get(route.name)?.href ?? nativeRouteAddress(route);

function viewRoot(element) {
  let root = lustreRoots.get(element);
  if (!root) {
    root = v.createRoot(element);
    lustreRoots.set(element, root);
  }
  return root;
}

export function unmount(element) {
  lustreRoots.get(element)?.unmount();
  lustreRoots.delete(element);
}

export function mountEditor(element, options) {
  viewRoot(element).render(z.jsx(qF.Provider, {
    value: {books: {}},
    children: z.jsx(cG, {
      profile: options.record,
      groups: options.groups,
      save: async (_books, patch) => options.save(patch),
      onSaved: options.onSaved,
      onDone: options.onDone,
    }),
  }));
}

export function registerApplication(application) {
  if (!/^[a-z][a-z0-9-]*$/.test(application.key)) throw Error('Invalid application key');
  const previous = [...lustreRoutes.values()].filter(route => route.application === application.key);
  for (const route of previous) {
    const index = ES.findIndex(item => item.id === route.id);
    if (index >= 0) ES.splice(index, 1);
    lustreRoutes.delete(route.id);
  }
  DS[application.key] = {label: application.label, order: application.order, open: true};
  for (const [index, item] of application.entries.entries()) {
    const id = application.key + '-' + item.key;
    if (ES.some(route => route.id === id)) throw Error('Duplicate application route');
    const definition = {
      id, scope: 'company', path: application.key + '/' + item.key, title: item.label,
      icon: props => z.jsx('img', {...props, src: item.icon, alt: ''}),
      place: {area: 'main', group: application.key, order: index},
      ...(item.needs ? {needs: item.needs} : {}),
    };
    ES.push(definition);
    lustreRoutes.set(id, {...item, id, application: application.key});
  }
  $F = QF();
}

function LustreMenu({options}) {
  const n = {name: options.current, companyId: options.companyId};
  const e = options.folded, g = !e;
  const {isOpen: v, toggle: y} = gR(n);
  const b = _.useId(), o = options.companyId, d = undefined;
  const p = rI(QF().filter(group => group.key === options.application), options.capabilities);
  return z.jsx(qF.Provider, {
    value: {route: n, navigate: route => options.onNavigate(lustreRoutes.get(route.name).key)},
    children: NATIVE_MENU_EXPRESSION,
  });
}

export function mountMenu(element, options) {
  viewRoot(element).render(z.jsx(LustreMenu, {options}));
}
