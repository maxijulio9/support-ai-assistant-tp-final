import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Params,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { legacyTabRedirectGuard, resolveLegacyTabRedirectPath } from './config-tabs';

describe('resolveLegacyTabRedirectPath', () => {
  it('resuelve una key valida', () => {
    expect(resolveLegacyTabRedirectPath('confluence')).toBe('confluence');
  });

  it('resuelve indexacion', () => {
    expect(resolveLegacyTabRedirectPath('indexacion')).toBe('indexacion');
  });

  it('resuelve llm', () => {
    expect(resolveLegacyTabRedirectPath('llm')).toBe('llm');
  });

  it('da null con una key invalida', () => {
    expect(resolveLegacyTabRedirectPath('no-existe')).toBeNull();
  });

  it('da null sin ningun tab', () => {
    expect(resolveLegacyTabRedirectPath(null)).toBeNull();
  });
});

describe('legacyTabRedirectGuard', () => {
  function snapshotWithQuery(queryParams: Params): ActivatedRouteSnapshot {
    return { queryParams, queryParamMap: convertToParamMap(queryParams) } as ActivatedRouteSnapshot;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('deja pasar cuando no hay ?tab=', () => {
    const result = TestBed.runInInjectionContext(() =>
      legacyTabRedirectGuard(snapshotWithQuery({}), {} as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });

  it('deja pasar cuando el ?tab= no es una key conocida', () => {
    const result = TestBed.runInInjectionContext(() =>
      legacyTabRedirectGuard(snapshotWithQuery({ tab: 'no-existe' }), {} as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });

  it('redirige a la ruta nueva preservando los demas query params', () => {
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      legacyTabRedirectGuard(
        snapshotWithQuery({ tab: 'confluence', project: 'TA' }),
        {} as RouterStateSnapshot,
      ),
    );

    expect(result).not.toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/config/confluence?project=TA');
  });
});
