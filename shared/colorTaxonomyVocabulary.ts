// Approved UpPulse V3 vocabulary. Independent of marketplace and identity.
export const COLOR_FAMILIES = [
  {
    "id": "preto",
    "domainCode": "PRETO",
    "label": "Preto",
    "dimension": "hue"
  },
  {
    "id": "branco",
    "domainCode": "BRANCO",
    "label": "Branco",
    "dimension": "hue"
  },
  {
    "id": "cinza",
    "domainCode": "CINZA",
    "label": "Cinza",
    "dimension": "hue"
  },
  {
    "id": "bege",
    "domainCode": "BEGE",
    "label": "Bege",
    "dimension": "hue"
  },
  {
    "id": "marrom",
    "domainCode": "MARROM",
    "label": "Marrom",
    "dimension": "hue"
  },
  {
    "id": "azul",
    "domainCode": "AZUL",
    "label": "Azul",
    "dimension": "hue"
  },
  {
    "id": "verde",
    "domainCode": "VERDE",
    "label": "Verde",
    "dimension": "hue"
  },
  {
    "id": "vermelho",
    "domainCode": "VERMELHO",
    "label": "Vermelho",
    "dimension": "hue"
  },
  {
    "id": "rosa",
    "domainCode": "ROSA",
    "label": "Rosa",
    "dimension": "hue"
  },
  {
    "id": "roxo",
    "domainCode": "ROXO",
    "label": "Roxo",
    "dimension": "hue"
  },
  {
    "id": "amarelo",
    "domainCode": "AMARELO",
    "label": "Amarelo",
    "dimension": "hue"
  },
  {
    "id": "laranja",
    "domainCode": "LARANJA",
    "label": "Laranja",
    "dimension": "hue"
  },
  {
    "id": "metalico",
    "domainCode": "METALICO",
    "label": "Metálico",
    "dimension": "appearance"
  },
  {
    "id": "multicolorido",
    "domainCode": "MULTICOLORIDO",
    "label": "Multicolorido",
    "dimension": "declared_palette"
  }
] as const;
export const CANONICAL_COLORS = [
  {
    "id": "preto",
    "label": "preto",
    "families": [
      "PRETO"
    ],
    "aliases": [
      "black"
    ],
    "kind": "color"
  },
  {
    "id": "branco",
    "label": "branco",
    "families": [
      "BRANCO"
    ],
    "aliases": [
      "white"
    ],
    "kind": "color"
  },
  {
    "id": "cinza",
    "label": "cinza",
    "families": [
      "CINZA"
    ],
    "aliases": [
      "grey",
      "gray",
      "grau",
      "grigio"
    ],
    "kind": "color"
  },
  {
    "id": "bege",
    "label": "bege",
    "families": [
      "BEGE"
    ],
    "aliases": [
      "beige"
    ],
    "kind": "color"
  },
  {
    "id": "marrom",
    "label": "marrom",
    "families": [
      "MARROM"
    ],
    "aliases": [
      "brown",
      "marron"
    ],
    "kind": "color"
  },
  {
    "id": "azul",
    "label": "azul",
    "families": [
      "AZUL"
    ],
    "aliases": [
      "blue",
      "blu"
    ],
    "kind": "color"
  },
  {
    "id": "verde",
    "label": "verde",
    "families": [
      "VERDE"
    ],
    "aliases": [
      "green"
    ],
    "kind": "color"
  },
  {
    "id": "vermelho",
    "label": "vermelho",
    "families": [
      "VERMELHO"
    ],
    "aliases": [
      "red"
    ],
    "kind": "color"
  },
  {
    "id": "rosa",
    "label": "rosa",
    "families": [
      "ROSA"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "pink",
    "label": "pink",
    "families": [
      "ROSA"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "roxo",
    "label": "roxo",
    "families": [
      "ROXO"
    ],
    "aliases": [
      "purple"
    ],
    "kind": "color"
  },
  {
    "id": "amarelo",
    "label": "amarelo",
    "families": [
      "AMARELO"
    ],
    "aliases": [
      "yellow"
    ],
    "kind": "color"
  },
  {
    "id": "laranja",
    "label": "laranja",
    "families": [
      "LARANJA"
    ],
    "aliases": [
      "orange"
    ],
    "kind": "color"
  },
  {
    "id": "azul-marinho",
    "label": "azul-marinho",
    "families": [
      "AZUL"
    ],
    "aliases": [
      "azul marinho",
      "navy"
    ],
    "kind": "color"
  },
  {
    "id": "azul-celeste",
    "label": "azul-celeste",
    "families": [
      "AZUL"
    ],
    "aliases": [
      "azul celeste"
    ],
    "kind": "color"
  },
  {
    "id": "azul-royal",
    "label": "azul-royal",
    "families": [
      "AZUL"
    ],
    "aliases": [
      "azul royal"
    ],
    "kind": "color"
  },
  {
    "id": "indigo",
    "label": "índigo",
    "families": [
      "AZUL"
    ],
    "aliases": [
      "indigo"
    ],
    "kind": "color"
  },
  {
    "id": "verde-militar",
    "label": "verde-militar",
    "families": [
      "VERDE"
    ],
    "aliases": [
      "verde militar"
    ],
    "kind": "color"
  },
  {
    "id": "oliva",
    "label": "oliva",
    "families": [
      "VERDE"
    ],
    "aliases": [
      "olive",
      "verde oliva"
    ],
    "kind": "color"
  },
  {
    "id": "menta",
    "label": "menta",
    "families": [
      "VERDE"
    ],
    "aliases": [
      "mint"
    ],
    "kind": "color"
  },
  {
    "id": "turquesa",
    "label": "turquesa",
    "families": [
      "AZUL"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "off-white",
    "label": "off-white",
    "families": [
      "BRANCO"
    ],
    "aliases": [
      "offwhite",
      "off white"
    ],
    "kind": "color"
  },
  {
    "id": "creme",
    "label": "creme",
    "families": [
      "BEGE"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "nude",
    "label": "nude",
    "families": [
      "BEGE"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "areia",
    "label": "areia",
    "families": [
      "BEGE"
    ],
    "aliases": [
      "sand"
    ],
    "kind": "color"
  },
  {
    "id": "cafe",
    "label": "café",
    "families": [
      "MARROM"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "caramelo",
    "label": "caramelo",
    "families": [
      "MARROM"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "castanho",
    "label": "castanho",
    "families": [
      "MARROM"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "conhaque",
    "label": "conhaque",
    "families": [
      "MARROM"
    ],
    "aliases": [
      "cognac"
    ],
    "kind": "color"
  },
  {
    "id": "terracota",
    "label": "terracota",
    "families": [
      "MARROM"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "grafite",
    "label": "grafite",
    "families": [
      "CINZA"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "vinho",
    "label": "vinho",
    "families": [
      "VERMELHO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "bordo",
    "label": "bordô",
    "families": [
      "VERMELHO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "rose",
    "label": "rosê",
    "families": [
      "ROSA"
    ],
    "aliases": [
      "rosé"
    ],
    "kind": "color"
  },
  {
    "id": "salmao",
    "label": "salmão",
    "families": [
      "ROSA"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "lilas",
    "label": "lilás",
    "families": [
      "ROXO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "lavanda",
    "label": "lavanda",
    "families": [
      "ROXO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "dourado",
    "label": "dourado",
    "families": [
      "METÁLICO"
    ],
    "aliases": [
      "gold"
    ],
    "kind": "color"
  },
  {
    "id": "prata",
    "label": "prata",
    "families": [
      "METÁLICO"
    ],
    "aliases": [
      "silver"
    ],
    "kind": "color"
  },
  {
    "id": "bronze",
    "label": "bronze",
    "families": [
      "METÁLICO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "cobre",
    "label": "cobre",
    "families": [
      "METÁLICO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "ouro-velho",
    "label": "ouro-velho",
    "families": [
      "METÁLICO"
    ],
    "aliases": [
      "ouro velho"
    ],
    "kind": "color"
  },
  {
    "id": "prata-velho",
    "label": "prata-velho",
    "families": [
      "METÁLICO"
    ],
    "aliases": [
      "prata velho"
    ],
    "kind": "color"
  },
  {
    "id": "multicolorido",
    "label": "multicolorido",
    "families": [
      "MULTICOLORIDO"
    ],
    "aliases": [
      "multicores",
      "multicolor"
    ],
    "kind": "declared_palette"
  },
  {
    "id": "caqui",
    "label": "cáqui",
    "families": [
      "BEGE"
    ],
    "aliases": [
      "caqui",
      "khaki"
    ],
    "kind": "color"
  },
  {
    "id": "coral",
    "label": "coral",
    "families": [
      "ROSA"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "ocre",
    "label": "ocre",
    "families": [
      "AMARELO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "tan",
    "label": "tan",
    "families": [
      "BEGE"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "teal",
    "label": "teal",
    "families": [
      "VERDE"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "pewter",
    "label": "pewter",
    "families": [
      "METÁLICO"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "petroleo",
    "label": "petróleo",
    "families": [
      "AZUL"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "incolor",
    "label": "incolor",
    "families": [],
    "aliases": [],
    "kind": "declared_chromatic_state"
  },
  {
    "id": "magenta",
    "label": "magenta",
    "families": [
      "ROSA"
    ],
    "aliases": [],
    "kind": "color"
  },
  {
    "id": "chumbo",
    "label": "chumbo",
    "families": [
      "CINZA"
    ],
    "aliases": [],
    "kind": "color"
  }
] as const;
export const COLOR_REVIEW_TERMS: Readonly<Record<string, string>> = {
  "carbon": "Nome comercial ou material/carbono; não equivaler a preto/grafite.",
  "natural": "Material/acabamento ou tonalidade indefinida; não equivaler a bege.",
  "denim": "Material/aparência; não equivaler a azul.",
  "jeans": "Material/aparência; não equivaler a azul.",
  "chrome": "Cromado/aparência ou nome comercial; não inferir prata ou METÁLICO sem confirmação.",
  "smoke": "Nome comercial variável; não inferir cinza.",
  "rose": "Pode ser rosa, rosê ou nome comercial; inglês sem acento não é alias automático de rosê.",
  "aqua": "Azul/verde-água comercial ambíguo; não equivaler automaticamente a turquesa.",
  "loiro": "Descritor não seguro de cor para tênis.",
  "unico": "Possível sentinela administrativa; não equivale a multicolorido.",
  "onca": "Estampa animal; não inferir marrom/preto/multicolorido.",
  "onca claro": "Estampa/luminosidade; não determina matiz.",
  "floral": "Estampa; não determina matizes.",
  "zebra": "Estampa; não inferir branco/preto/multicolorido."
};
