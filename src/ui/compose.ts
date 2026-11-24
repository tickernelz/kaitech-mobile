type Compose = typeof import('@expo/ui/jetpack-compose');

let loaded: Compose | null = null;

export function compose(): Compose {
  loaded ??= require('@expo/ui/jetpack-compose') as Compose;
  return loaded;
}
