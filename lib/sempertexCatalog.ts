/**
 * Sempertex Balloon Colour Catalogue — Sample Data
 *
 * Source: Sempertex color chart (85 colors).
 *
 * TODO: Replace availableSizes with official supplier size availability per SKU.
 *
 * IMPORTANT: hex values are approximate visual previews only.
 * Physical balloon color should always follow official Sempertex chart/samples.
 *
 * TODO: Replace this data with the full official Sempertex/supplier catalogue
 * including all colors, supplier SKU, finish, family, hex approximation,
 * available sizes, and stock status. Source from lib/sempertexCatalog.ts.
 */

export interface SempertexColor {
  id: string;
  code: string;
  brand: "Sempertex";
  colorName: string;
  finish: string;
  family: string;
  /** Approximate hex preview only — physical color follows Sempertex chart/samples */
  hex: string;
  /** TODO: Replace with official per-SKU size availability from supplier */
  availableSizes: string[];
}

export const SEMPERTEX_CATALOG: SempertexColor[] = [
  { id:"fashion-390-clear",             code:"390", brand:"Sempertex", colorName:"Clear",           finish:"Fashion",      family:"white",   hex:"#F0F4F8", availableSizes:["11"] },
  { id:"fashion-005-white",             code:"005", brand:"Sempertex", colorName:"White",           finish:"Fashion",      family:"white",   hex:"#FFFFFF", availableSizes:["11"] },
  { id:"satin-405-white",               code:"405", brand:"Sempertex", colorName:"White",           finish:"Satin",        family:"white",   hex:"#FEFEFE", availableSizes:["11"] },
  { id:"satin-406-pearl",               code:"406", brand:"Sempertex", colorName:"Pearl",           finish:"Satin",        family:"white",   hex:"#F5F0EE", availableSizes:["11"] },
  { id:"pastel-dusk-107-cream",         code:"107", brand:"Sempertex", colorName:"Cream",           finish:"Pastel Dusk",  family:"neutral", hex:"#FFF8E7", availableSizes:["11"] },
  { id:"silk-806-oyster-white",         code:"806", brand:"Sempertex", colorName:"Oyster White",    finish:"Silk",         family:"white",   hex:"#FAF6F0", availableSizes:["11"] },
  { id:"fashion-071-white-sand",        code:"071", brand:"Sempertex", colorName:"White Sand",      finish:"Fashion",      family:"neutral", hex:"#F5EDD6", availableSizes:["11"] },
  { id:"pastel-matte-620-yellow",       code:"620", brand:"Sempertex", colorName:"Yellow",          finish:"Pastel Matte", family:"yellow",  hex:"#FEF08A", availableSizes:["11"] },
  { id:"neon-220-yellow",               code:"220", brand:"Sempertex", colorName:"Yellow",          finish:"Neon",         family:"yellow",  hex:"#FEFF38", availableSizes:["11"] },
  { id:"fashion-020-yellow",            code:"020", brand:"Sempertex", colorName:"Yellow",          finish:"Fashion",      family:"yellow",  hex:"#FFD700", availableSizes:["11"] },
  { id:"fashion-021-honey-yellow",      code:"021", brand:"Sempertex", colorName:"Honey Yellow",    finish:"Fashion",      family:"yellow",  hex:"#FFC200", availableSizes:["11"] },
  { id:"fashion-023-mustard",           code:"023", brand:"Sempertex", colorName:"Mustard",         finish:"Fashion",      family:"yellow",  hex:"#D4A017", availableSizes:["11"] },
  { id:"fashion-073-latte",             code:"073", brand:"Sempertex", colorName:"Latte",           finish:"Fashion",      family:"neutral", hex:"#C9A96E", availableSizes:["11"] },
  { id:"metallic-570-gold",             code:"570", brand:"Sempertex", colorName:"Gold",            finish:"Metallic",     family:"gold",    hex:"#FFD700", availableSizes:["11"] },
  { id:"reflex-970-gold",               code:"970", brand:"Sempertex", colorName:"Gold",            finish:"Reflex",       family:"gold",    hex:"#FDE68A", availableSizes:["11"] },
  { id:"silk-870-gold-dust",            code:"870", brand:"Sempertex", colorName:"Gold Dust",       finish:"Silk",         family:"gold",    hex:"#FEF08A", availableSizes:["11"] },
  { id:"reflex-971-champagne",          code:"971", brand:"Sempertex", colorName:"Champagne",       finish:"Reflex",       family:"gold",    hex:"#F5E6C8", availableSizes:["11"] },
  { id:"pastel-matte-663-melon",        code:"663", brand:"Sempertex", colorName:"Melon",           finish:"Pastel Matte", family:"peach",   hex:"#FDBA74", availableSizes:["11"] },
  { id:"metallic-568-rose-gold",        code:"568", brand:"Sempertex", colorName:"Rose Gold",       finish:"Metallic",     family:"gold",    hex:"#FECDD3", availableSizes:["11"] },
  { id:"pastel-matte-660-malibu-peach", code:"660", brand:"Sempertex", colorName:"Malibu Peach",   finish:"Pastel Matte", family:"peach",   hex:"#FDBA74", availableSizes:["11"] },
  { id:"fashion-060-peach-blush",       code:"060", brand:"Sempertex", colorName:"Peach Blush",     finish:"Fashion",      family:"peach",   hex:"#FFD1A4", availableSizes:["11"] },
  { id:"neon-261-orange",               code:"261", brand:"Sempertex", colorName:"Orange",          finish:"Neon",         family:"orange",  hex:"#FF7F00", availableSizes:["11"] },
  { id:"fashion-061-orange",            code:"061", brand:"Sempertex", colorName:"Orange",          finish:"Fashion",      family:"orange",  hex:"#FF8C00", availableSizes:["11"] },
  { id:"fashion-061-sunset-orange",     code:"061", brand:"Sempertex", colorName:"Sunset Orange",   finish:"Fashion",      family:"orange",  hex:"#FF6B35", availableSizes:["11"] },
  { id:"fashion-074-coffee",            code:"074", brand:"Sempertex", colorName:"Coffee",          finish:"Fashion",      family:"neutral", hex:"#6F4E37", availableSizes:["11"] },
  { id:"fashion-076-chocolate",         code:"076", brand:"Sempertex", colorName:"Chocolate",       finish:"Fashion",      family:"neutral", hex:"#7B3F00", availableSizes:["11"] },
  { id:"fashion-015-red",               code:"015", brand:"Sempertex", colorName:"Red",             finish:"Fashion",      family:"red",     hex:"#EF4444", availableSizes:["11"] },
  { id:"fashion-016-imperial-red",      code:"016", brand:"Sempertex", colorName:"Imperial Red",    finish:"Fashion",      family:"red",     hex:"#DC2626", availableSizes:["11"] },
  { id:"metallic-515-red",              code:"515", brand:"Sempertex", colorName:"Red",             finish:"Metallic",     family:"red",     hex:"#E53E3E", availableSizes:["11"] },
  { id:"reflex-915-crystal-red",        code:"915", brand:"Sempertex", colorName:"Crystal Red",     finish:"Reflex",       family:"red",     hex:"#FC5C65", availableSizes:["11"] },
  { id:"fashion-018-merlot",            code:"018", brand:"Sempertex", colorName:"Merlot",          finish:"Fashion",      family:"red",     hex:"#800020", availableSizes:["11"] },
  { id:"reflex-912-fuchsia",            code:"912", brand:"Sempertex", colorName:"Fuchsia",         finish:"Reflex",       family:"pink",    hex:"#E879F9", availableSizes:["11"] },
  { id:"fashion-009-pink",              code:"009", brand:"Sempertex", colorName:"Pink",            finish:"Fashion",      family:"pink",    hex:"#F9A8D4", availableSizes:["11"] },
  { id:"pastel-matte-609-pink",         code:"609", brand:"Sempertex", colorName:"Pink",            finish:"Pastel Matte", family:"pink",    hex:"#FBCFE8", availableSizes:["11"] },
  { id:"pastel-dusk-110-rose",          code:"110", brand:"Sempertex", colorName:"Rose",            finish:"Pastel Dusk",  family:"pink",    hex:"#FDA4AF", availableSizes:["11"] },
  { id:"fashion-010-rosewood",          code:"010", brand:"Sempertex", colorName:"Rosewood",        finish:"Fashion",      family:"pink",    hex:"#DB7093", availableSizes:["11"] },
  { id:"fashion-059-tropical-coral",    code:"059", brand:"Sempertex", colorName:"Tropical Coral",  finish:"Fashion",      family:"pink",    hex:"#FF6B6B", availableSizes:["11"] },
  { id:"metallic-512-fuchsia",          code:"512", brand:"Sempertex", colorName:"Fuchsia",         finish:"Metallic",     family:"pink",    hex:"#E040FB", availableSizes:["11"] },
  { id:"fashion-012-fuchsia",           code:"012", brand:"Sempertex", colorName:"Fuchsia",         finish:"Fashion",      family:"pink",    hex:"#FF1DCE", availableSizes:["11"] },
  { id:"fashion-014-raspberry",         code:"014", brand:"Sempertex", colorName:"Raspberry",       finish:"Fashion",      family:"pink",    hex:"#E30B5C", availableSizes:["11"] },
  { id:"neon-212-fuchsia",              code:"212", brand:"Sempertex", colorName:"Fuchsia",         finish:"Neon",         family:"pink",    hex:"#FF10F0", availableSizes:["11"] },
  { id:"satin-409-pink",                code:"409", brand:"Sempertex", colorName:"Pink",            finish:"Satin",        family:"pink",    hex:"#F9A8D4", availableSizes:["11"] },
  { id:"silk-809-pink-blossom",         code:"809", brand:"Sempertex", colorName:"Pink Blossom",    finish:"Silk",         family:"pink",    hex:"#FBCFE8", availableSizes:["11"] },
  { id:"reflex-909-pink",               code:"909", brand:"Sempertex", colorName:"Pink",            finish:"Reflex",       family:"pink",    hex:"#FC9CB4", availableSizes:["11"] },
  { id:"reflex-968-rose-gold",          code:"968", brand:"Sempertex", colorName:"Rose Gold",       finish:"Reflex",       family:"gold",    hex:"#FECDD3", availableSizes:["11"] },
  { id:"silk-850-light-amethyst",       code:"850", brand:"Sempertex", colorName:"Light Amethyst",  finish:"Silk",         family:"purple",  hex:"#EDE9FE", availableSizes:["11"] },
  { id:"pastel-matte-650-lilac",        code:"650", brand:"Sempertex", colorName:"Lilac",           finish:"Pastel Matte", family:"purple",  hex:"#DDD6FE", availableSizes:["11"] },
  { id:"fashion-050-lilac",             code:"050", brand:"Sempertex", colorName:"Lilac",           finish:"Fashion",      family:"purple",  hex:"#C084FC", availableSizes:["11"] },
  { id:"pastel-dusk-150-lavender",      code:"150", brand:"Sempertex", colorName:"Lavender",        finish:"Pastel Dusk",  family:"purple",  hex:"#E9D5FF", availableSizes:["11"] },
  { id:"satin-450-lilac",               code:"450", brand:"Sempertex", colorName:"Lilac",           finish:"Satin",        family:"purple",  hex:"#D8B4FE", availableSizes:["11"] },
  { id:"reflex-951-violet",             code:"951", brand:"Sempertex", colorName:"Violet",          finish:"Reflex",       family:"purple",  hex:"#A855F7", availableSizes:["11"] },
  { id:"fashion-056-purple-orchid",     code:"056", brand:"Sempertex", colorName:"Purple Orchid",   finish:"Fashion",      family:"purple",  hex:"#A21CAF", availableSizes:["11"] },
  { id:"fashion-051-violet",            code:"051", brand:"Sempertex", colorName:"Violet",          finish:"Fashion",      family:"purple",  hex:"#7C3AED", availableSizes:["11"] },
  { id:"fashion-044-navy-blue",         code:"044", brand:"Sempertex", colorName:"Navy Blue",       finish:"Fashion",      family:"blue",    hex:"#1E3A8A", availableSizes:["11"] },
  { id:"reflex-940-blue",               code:"940", brand:"Sempertex", colorName:"Blue",            finish:"Reflex",       family:"blue",    hex:"#3B82F6", availableSizes:["11"] },
  { id:"fashion-035-deep-teal",         code:"035", brand:"Sempertex", colorName:"Deep Teal",       finish:"Fashion",      family:"blue",    hex:"#0F766E", availableSizes:["11"] },
  { id:"metallic-540-blue",             code:"540", brand:"Sempertex", colorName:"Blue",            finish:"Metallic",     family:"blue",    hex:"#60A5FA", availableSizes:["11"] },
  { id:"fashion-041-royal-blue",        code:"041", brand:"Sempertex", colorName:"Royal Blue",      finish:"Fashion",      family:"blue",    hex:"#2563EB", availableSizes:["11"] },
  { id:"silk-839-arctic-blue",          code:"839", brand:"Sempertex", colorName:"Arctic Blue",     finish:"Silk",         family:"blue",    hex:"#BAE6FD", availableSizes:["11"] },
  { id:"pastel-dusk-140-blue",          code:"140", brand:"Sempertex", colorName:"Blue",            finish:"Pastel Dusk",  family:"blue",    hex:"#BFDBFE", availableSizes:["11"] },
  { id:"neon-240-blue",                 code:"240", brand:"Sempertex", colorName:"Blue",            finish:"Neon",         family:"blue",    hex:"#00BFFF", availableSizes:["11"] },
  { id:"fashion-040-blue",              code:"040", brand:"Sempertex", colorName:"Blue",            finish:"Fashion",      family:"blue",    hex:"#3B82F6", availableSizes:["11"] },
  { id:"fashion-038-caribbean-blue",    code:"038", brand:"Sempertex", colorName:"Caribbean Blue",  finish:"Fashion",      family:"blue",    hex:"#0EA5E9", availableSizes:["11"] },
  { id:"satin-440-blue",                code:"440", brand:"Sempertex", colorName:"Blue",            finish:"Satin",        family:"blue",    hex:"#7DD3FC", availableSizes:["11"] },
  { id:"pastel-matte-640-blue",         code:"640", brand:"Sempertex", colorName:"Blue",            finish:"Pastel Matte", family:"blue",    hex:"#BAE6FD", availableSizes:["11"] },
  { id:"fashion-037-aquamarine",        code:"037", brand:"Sempertex", colorName:"Aquamarine",      finish:"Fashion",      family:"blue",    hex:"#00CED1", availableSizes:["11"] },
  { id:"pastel-matte-630-green",        code:"630", brand:"Sempertex", colorName:"Green",           finish:"Pastel Matte", family:"green",   hex:"#BBF7D0", availableSizes:["11"] },
  { id:"satin-430-green",               code:"430", brand:"Sempertex", colorName:"Green",           finish:"Satin",        family:"green",   hex:"#6EE7B7", availableSizes:["11"] },
  { id:"neon-230-green",                code:"230", brand:"Sempertex", colorName:"Green",           finish:"Neon",         family:"green",   hex:"#57FF1A", availableSizes:["11"] },
  { id:"fashion-031-lime-green",        code:"031", brand:"Sempertex", colorName:"Lime Green",      finish:"Fashion",      family:"green",   hex:"#84CC16", availableSizes:["11"] },
  { id:"fashion-030-green",             code:"030", brand:"Sempertex", colorName:"Green",           finish:"Fashion",      family:"green",   hex:"#22C55E", availableSizes:["11"] },
  { id:"metallic-530-green",            code:"530", brand:"Sempertex", colorName:"Green",           finish:"Metallic",     family:"green",   hex:"#4ADE80", availableSizes:["11"] },
  { id:"fashion-029-shamrock-green",    code:"029", brand:"Sempertex", colorName:"Shamrock Green",  finish:"Fashion",      family:"green",   hex:"#16A34A", availableSizes:["11"] },
  { id:"fashion-032-forest-green",      code:"032", brand:"Sempertex", colorName:"Forest Green",    finish:"Fashion",      family:"green",   hex:"#15803D", availableSizes:["11"] },
  { id:"reflex-932-aurora-green",       code:"932", brand:"Sempertex", colorName:"Aurora Green",    finish:"Reflex",       family:"green",   hex:"#10B981", availableSizes:["11"] },
  { id:"pastel-dusk-126-green-tea",     code:"126", brand:"Sempertex", colorName:"Green Tea",       finish:"Pastel Dusk",  family:"green",   hex:"#D1FAE5", availableSizes:["11"] },
  { id:"fashion-027-eucalyptus",        code:"027", brand:"Sempertex", colorName:"Eucalyptus",      finish:"Fashion",      family:"green",   hex:"#6EE7B7", availableSizes:["11"] },
  { id:"reflex-931-lime-green",         code:"931", brand:"Sempertex", colorName:"Lime Green",      finish:"Reflex",       family:"green",   hex:"#A3E635", availableSizes:["11"] },
  { id:"silk-826-cool-mint",            code:"826", brand:"Sempertex", colorName:"Cool Mint",       finish:"Silk",         family:"green",   hex:"#A7F3D0", availableSizes:["11"] },
  { id:"fashion-081-grey",              code:"081", brand:"Sempertex", colorName:"Grey",            finish:"Fashion",      family:"silver",  hex:"#9CA3AF", availableSizes:["11"] },
  { id:"satin-481-silver",              code:"481", brand:"Sempertex", colorName:"Silver",          finish:"Satin",        family:"silver",  hex:"#D1D5DB", availableSizes:["11"] },
  { id:"silk-873-cream-pearl",          code:"873", brand:"Sempertex", colorName:"Cream Pearl",     finish:"Silk",         family:"white",   hex:"#FEF3C7", availableSizes:["11"] },
  { id:"reflex-981-silver",             code:"981", brand:"Sempertex", colorName:"Silver",          finish:"Reflex",       family:"silver",  hex:"#E5E7EB", availableSizes:["11"] },
  { id:"metallic-580-black",            code:"580", brand:"Sempertex", colorName:"Black",           finish:"Metallic",     family:"black",   hex:"#374151", availableSizes:["11"] },
  { id:"fashion-080-black",             code:"080", brand:"Sempertex", colorName:"Black",           finish:"Fashion",      family:"black",   hex:"#1F2937", availableSizes:["11"] },
];
