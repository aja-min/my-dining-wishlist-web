import type { NewShop, Shop } from './model';
export interface ShopRepository {
  list(): Promise<Shop[]>;
  add(input: NewShop): Promise<Shop>;
  remove(id: string): Promise<void>;
  setVisited(id: string, visited: boolean): Promise<void>;
  setTags(id: string, tags: string[]): Promise<void>;
  like(id: string, operationId: string): Promise<void>;
  fillMissingIds(): Promise<number>;
}
