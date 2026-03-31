/**
 * Ordem das fileiras na home (estilo Netflix). Slugs = parâmetro /Browse?section=
 */
export const NETFLIX_HOME_ROW_ORDER = [
  { slug: 'mais_assistidos', label: 'Mais Assistidos' },
  { slug: 'destaques', label: 'Destaques' },
  { slug: 'sagas_completas', label: 'Sagas Completas' },
  { slug: 'novidades', label: 'Novidades' },
  { slug: 'em_breve', label: 'Em breve' },
  { slug: 'originais', label: 'Originais' },
  { slug: 'terror_psicologico', label: 'Terror psicológico' },
  { slug: 'paranormal', label: 'Paranormal' },
  { slug: 'slashers', label: 'Slashers' },
  { slug: 'terror_cult', label: 'Terror cult' },
  { slug: 'sobrevivencia_apocalipse', label: 'Sobrevivência / Apocalipse' },
  { slug: 'ficcao_cientifica_de_terror', label: 'Ficção Científica de Terror' },
  { slug: 'found_footage', label: 'Found Footage' },
];

export const SLUG_TO_LABEL = Object.fromEntries(
  NETFLIX_HOME_ROW_ORDER.map(({ slug, label }) => [slug, label])
);

export const LABEL_TO_SLUG = Object.fromEntries(
  NETFLIX_HOME_ROW_ORDER.map(({ slug, label }) => [label, slug])
);
