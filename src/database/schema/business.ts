import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { provenanceColumns, timestamps } from './enums';

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  canonicalName: text('canonical_name').notNull(),
  /** toLookupKey(canonicalName); written by the application so lookup normalisation lives in one place. */
  canonicalNameKey: text('canonical_name_key').notNull().unique(),
  ...timestamps(),
});

export const businessAliases = pgTable('business_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
  /** Globally unique so an alias can never resolve to two businesses. */
  aliasKey: text('alias_key').notNull().unique(),
  ...provenanceColumns(),
});

export const coaches = pgTable('coaches', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  ...timestamps(),
});
