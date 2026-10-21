import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

// Paths reales de las secciones bajo /config. El viejo ?tab= usaba estos
// mismos strings como key, asi que la migracion es solo "usalo como path".
export const CONFIG_SECTION_PATHS = ['jsm', 'proyectos', 'campos', 'confluence', 'indexacion', 'llm'] as const;

export type ConfigSectionPath = (typeof CONFIG_SECTION_PATHS)[number];

// null si no hay nada que redirigir (sin ?tab=, o con un valor que no es
// una key conocida): en ese caso el centro se muestra normalmente.
export function resolveLegacyTabRedirectPath(tabParam: string | null): ConfigSectionPath | null {
  const match = CONFIG_SECTION_PATHS.find((path) => path === tabParam);
  return match ?? null;
}

// Redirige /config?tab=xxx a /config/xxx preservando el resto de los query
// params (por ejemplo ?project=). Links y bookmarks viejos siguen andando.
export const legacyTabRedirectGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const target = resolveLegacyTabRedirectPath(route.queryParamMap.get('tab'));
  if (!target) return true;

  const router = inject(Router);
  const { tab: _tab, ...queryParams } = route.queryParams;
  return router.createUrlTree(['/config', target], { queryParams });
};
