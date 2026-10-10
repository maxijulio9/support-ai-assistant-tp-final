// Ruta de login del frontend y helper para saber si una URL de navegacion
// (que puede traer query string y fragment) apunta a esa ruta. La usan el
// interceptor y AuthService para no navegar de nuevo si ya estamos ahi.
export const LOGIN_ROUTE = '/login';

function stripQueryAndFragment(url: string): string {
  const cutIndex = url.search(/[?#]/);
  return cutIndex === -1 ? url : url.substring(0, cutIndex);
}

export function isLoginRoute(url: string): boolean {
  return stripQueryAndFragment(url) === LOGIN_ROUTE;
}
