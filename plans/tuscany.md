# Tuscany: an Exploration Age civilization

Design sheet written 2026-09-09 following `.claude/skills/new-civilization/` and modelled on
`Byzantium/`. Companion plans: [etruscans.md](etruscans.md) — the Antiquity predecessor — and
[etruscans-tuscany-log.md](etruscans-tuscany-log.md), the running work log.

Theme, as Marco set it: **economy, Discovery (Amerigo Vespucci) and art — the Renaissance and the
geniuses, Leonardo and Raffaello**. The three pull in the same direction: Florentine banking pays
for the workshops, the workshops produce the Great Works, and a Florentine navigator gives his name
to a hemisphere. The marquee mechanic is a unique Great Person class, the **Maestro**, whose named
individuals are the geniuses themselves.

## 1. Design sheet

| Item | Decision |
|---|---|
| Ids | `CIVILIZATION_TUSCANY`, `TRAIT_TUSCANY`, `TRAIT_TUSCANY_ABILITY`; mod id `tuscany`, folder `Tuscany/` |
| Names | Tuscany / The Florentine Republic / Tuscan; capital Florence |
| Apex age | Exploration (`TAG_APEX_AGE_EXPLORATION`) |
| Attributes | Economic + Cultural. Traits `TRAIT_ATTRIBUTE_ECONOMIC` (+`_TOT_AQ`, `_TOT_MO`), `TRAIT_ATTRIBUTE_CULTURAL` (+`_TOT_AQ`, `_TOT_MO`); tags `TAG_TRAIT_ECONOMIC`, `TAG_TRAIT_CULTURAL` |
| Ability | **Rinascimento** (see 1.1) |
| Unique units | **Maestro** (Great Person class, 10 named individuals — see 1.2), **Condottiero** (3-tier infantry line) and **Galea di Santo Stefano** (replaces Cog) |
| Unique quarter | **Piazza** = Bottega + Banco (see 1.4) |
| Associated wonder | **Santa Maria del Fiore** — Brunelleschi's dome |
| Civics | Mecenatismo, Umanesimo, Navigatori (see 1.6) |
| Unlocked by | Etruscans (historical), Rome (historical), Greece (geographic — the Greek scholars who brought Plato to Florence); leaders Lorenzo (historical), Machiavelli (historical), Isabella (strategic), Ibn Battuta (geographic). Gameplay unlock: own 3 `BUILDING_BANK` |
| Unlocks | America (Modern, historical — the hemisphere is named after a Florentine) and French Empire (Modern, strategic — Napoleon's Kingdom of Italy) |
| Start bias | navigable river +150, coast +50, grassland biome; favoured wonder Santa Maria del Fiore |
| Art cultures | buildings `BUILDING_CULTURE_MED`, `_MED_ANT`, `_MED_EXP`, `BUILDING_CULTURE_SAM_MOD`, `ANT_STONE`, `EXP_STONE`, `MOD_STONE`; units `Euro` |
| True start | Florence, on the Arno: `[11.25, 43.77]` on all three geo files |
| Leader | **Lorenzo il Magnifico** — see 3 |

Cities (30): Florence, Siena, Pisa, Lucca, Arezzo, Livorno, Prato, Pistoia, Volterra, Cortona,
Montepulciano, San Gimignano, Grosseto, Massa, Carrara, Piombino, Empoli, Fiesole, Colle di Val
d'Elsa, Poggibonsi, Certaldo, Anghiari, Pienza, Montalcino, Sansepolcro, Vinci, Barga, Portoferraio,
Pescia, Bibbiena.

Citizens — male: Leonardo, Raffaello, Filippo, Donatello, Sandro, Niccolo, Amerigo, Dante,
Cosimo, Galileo; female: Caterina, Bianca, Lucrezia, Simonetta, Contessina, Isabella, Ginevra,
Clarice, Beatrice, Fioretta.

### 1.1 Ability: Rinascimento

1. +2 Gold and +1 Culture in every Settlement (`EFFECT_CITY_ADJUST_YIELD` on
   `COLLECTION_PLAYER_CITIES`). All ages.
2. +1 Culture per Great Work in a Settlement (`EFFECT_CITY_ADJUST_YIELD_PER_GREAT_WORK`, the
   proven Bulgaria shape). All ages.
3. +30% Production toward Santa Maria del Fiore
   (`EFFECT_CITY_ADJUST_FAVORED_WONDER_PRODUCTION`), persist group.
4. Reveal the Tuscan civic tree, Exploration only.

### 1.2 The Maestro (`GREAT_PERSON_CLASS_MAESTRO`)

Modelled exactly on the Abbasid **Alim** (`age-exploration/data/greatpeople.xml`): a unique Great
Person class bound to the civ's unique quarter, `GenerateDuplicateIndividuals="true"`, trainable
civilian unit `UNIT_MAESTRO` (cost 40, `COST_PROGRESSION_PREVIOUS_COPIES`), plus one
`CanTrain="false"` unit per named individual so the retired figure keeps their own name and icon.

Ten individuals, each reusing a Great Person modifier that already ships in the Exploration age:

| Maestro | Action requires | Effect (base modifier) |
|---|---|---|
| Leonardo da Vinci | Urban district, Piazza quarter completed | a free random Technology (`GREATPERSON_RANDOM_TECH`) |
| Raffaello Sanzio | Urban district, CULTURE building | +Culture on the district (`GREATPERSON_CULTURE_BUILDING` family) |
| Michelangelo Buonarroti | Urban district, Piazza quarter completed | Culture, the Ulema-science shape retargeted to Culture |
| Sandro Botticelli | Urban district, CULTURE building | Happiness (`GREATPERSON_HAPPINESS`) |
| Donatello | Urban district | a Tradition slot (`GREATPERSON_TRADITION_SLOT`) |
| Filippo Brunelleschi | Urban district, no Observatory in city | builds an Observatory (`GREATPERSON_OBSERVATORY` + small Science) |
| Dante Alighieri | City centre | Happiness and Culture |
| Niccolò Machiavelli | Any owned tile | Diplomacy tokens (`GREATPERSON_DIPLO_TOKENS`) |
| Galileo Galilei | Urban district, SCIENCE building | Science on the district |
| Amerigo Vespucci | Any tile, no owner required | reveals the map (`GREATPERSON_REVEAL`) and Gold from natural wonders |

Exact modifier ids are resolved against the shipped `greatpeople-gameeffects.xml` while writing the
file — none are invented. Where the age has no suitable base modifier the effect is written locally
in `data/greatpeople-gameeffects.xml` using a proven effect shape.

### 1.3 The other unique units

**Condottiero** (`UNIT_CONDOTTIERO`, `_2`, `_3`) — the mercenary captains who fought Italy's wars
for pay. Replaces Swordsman / Man-at-Arms / Pikeman. Combat **40 / 45 / 50**, i.e. **+5** over each
of them; cost 140 / 180 / 230; upkeep **3 / 5 / 7**, one above the standard line at every tier;
moves 2. Ability *Contratto*: +4 Combat Strength when attacking
(`REQUIREMENT_PLAYER_IS_ATTACKING`). Tier 2 unlocks at `NODE_TECH_EX_HERALDRY`, tier 3 at
`NODE_TECH_EX_METAL_CASTING` (where the Man-at-Arms and the Pikeman unlock). Visual remaps to
`UNIT_SWORDSMAN`, `UNIT_MAN_AT_ARMS`, `UNIT_PIKEMAN`.

+5 is the ceiling the base game uses: across its 130 unique/base unit pairs the median difference
is 0 and only the Yumi's second tier goes past +5, on single-digit archer numbers. At 40 / 45 / 50
each Condottiero tier is level with the *next* standard unit — the first fights a Man-at-Arms
evenly, the second a Pikeman, the third a Lancer. It was +2 before (37 / 42 / 47, the Tercio's
numbers) while costing 10 more production and the same upkeep, which is a Swordsman that costs more
and dies to everything. The upkeep is where the strength is paid for: a condottiere was hired, and
went home when the pay stopped — and Tuscany is the civilization that can afford him.

**Galea di Santo Stefano** (`UNIT_GALEA_SANTO_STEFANO`) — the galleys of the Tuscan military order
based at Livorno and Pisa. Replaces Cog, upgrades to Carrack. Combat 30, Ranged 35, Bombard 30,
Range 2, moves 4 (+1), sight 3 (+1). Ability *Rotta per l'Occidente*: +1 sight and +5 Combat
Strength against naval units. Visual remap to `UNIT_COG`.

### 1.4 Unique quarter: Piazza

Two buildings, `Age="AGE_EXPLORATION"`, cost 290, population 1, city centre + urban, maintenance
3 Gold + 3 Happiness, tags UNIQUE + AGELESS.

- **Bottega** (the artist's workshop where Verrocchio taught Leonardo): +5 Culture, +2 Gold;
  +1 Culture per adjacent Quarter; one Great Work slot. Tag CULTURE.
- **Banco** (the Medici bank and its branches): +6 Gold, +2 Influence; +1 Gold per adjacent
  Quarter. Tag GOLD.
- **Quarter effect**: +1 Gold and +1 Culture in every Settlement, and the Piazza is what makes the
  Maestro available (`GreatPersonClasses.UniqueQuarterType`).

### 1.5 Wonder: Santa Maria del Fiore

`WONDER_SANTA_MARIA_DEL_FIORE`. Cost 750, +5 Culture, +3 Gold, +2 Happiness, +1 Science, 3 Great
Work slots, Ageless, one per world, `RequiresUnlock`. Grants a Relic on completion (the Rila
pattern Byzantium uses for the Hagia Sophia). Quote: Alberti to Brunelleschi on the dome, "ample
enough to cover with its shadow all the Tuscan people". Unlocked at depth 1 by the Umanesimo civic,
at depth 2 by `NODE_TECH_EX_ARCHITECTURE` for everyone else. Visual remap to `WONDER_NOTRE_DAME`.

### 1.6 Civic tree `TREE_CIVICS_EX_TUSCANY`

| Node | Cost | Unlocks |
|---|---|---|
| Mecenatismo | 800 | Bottega, Banco, traditions **Mecenatismo** and **Fiorino**, `MOD_EX_SETTLEMENT_CAP_INCREASE` |
| Umanesimo (req. Mecenatismo) | 1200 | Santa Maria del Fiore, traditions **Umanesimo** and **Prospettiva**, `MOD_EX_RELIC` |
| Navigatori (req. Mecenatismo) | 2000 | traditions **Navigatori** and **Arte della Lana**, `MOD_TOT_TRADITION_SLOT` |

Traditions:
- **Mecenatismo** — +2 Culture on buildings tagged CULTURE.
- **Fiorino** — +2 Gold in every Settlement.
- **Umanesimo** — +1 Science and +1 Culture in every Settlement.
- **Prospettiva** — +1 Happiness and +1 Influence per Great Work.
- **Navigatori** — +1 Movement and +1 Sight for naval units (the Discovery half).
- **Arte della Lana** — +15% Production toward buildings.
- Test of Time: **Fiorino I** (Antiquity), **Umanesimo II** (Modern, obsoletes Umanesimo);
  self-syncretism **Toscana I** (Antiquity) and **Toscana II** (Modern).

Test of Time nodes: `NODE_CIVIC_AQ_TUSCANY_ORIGINS` (cost 150) and
`NODE_CIVIC_MO_TUSCANY_GRANDUCATO` (cost 2000), wired like Byzantium's.

## 2. Exploration Age only

Tuscany is **not** Time-Tested, unlike Byzantium and the Etruscans. It belongs to the Exploration
Age and nothing else: one `Civilizations` row in the shell config (`ExplorationAgeCivilizations`),
one set of `CivilizationItems` and `CivilizationTags`, ability modifiers wired only in
`civilizations-exploration.xml`, no `TRAIT_ATTRIBUTE_*_TOT_AQ` / `_TOT_MO`, no nodes in the
Antiquity or Modern Test of Time trees, and no `CivSelfSyncretismUnlocks` — that last table is
precisely what lets a civilization be taken again in a later age.

What does stay, and is easy to mistake for the same thing:

- The `CivilizationUnlocks` rows whose `CivilizationDomain` is `AntiquityAgeCivilizations`. Those
  are Rome and Greece (and, from the Etruscans mod, Etruria) leading *into* Tuscany — the domain
  is the unlocking civ's, not Tuscany's.
- `exploration-age-persist` in the modinfo, which spans Exploration **and** Modern. The Piazza,
  Santa Maria del Fiore and the traditions that name them are AGELESS and have to survive into
  the Modern Age even though Tuscany itself cannot be chosen there.
- Lorenzo's `TRAIT_AQ_ECONOMIC_VICTORY` and `TRAIT_MO_CULTURE_VICTORY`. A leader plays every age
  whatever civ they are wearing.

## 3. Leader: Lorenzo il Magnifico

`LEADER_LORENZO`, Lorenzo de' Medici — banker, poet, and the man who kept the Italian peace for
twelve years and paid for the workshops that trained Michelangelo. Attributes **Cultural +
Economic** (tags `TAG_TRAIT_CULTURAL`, `TAG_TRAIT_ECONOMIC`, `TAG_GENDER_MALE`).

Ability **Il Magnifico** (`TRAIT_LEADER_LORENZO_ABILITY`), ten modifiers:

*The workshops.* +3 Gold and +1 Happiness per Great Work in a Settlement
(`EFFECT_CITY_ADJUST_YIELD_PER_GREAT_WORK`), +1 Culture in every Settlement.

*Wonders.* +20% Production toward Wonders (`EFFECT_CITY_ADJUST_WONDER_PRODUCTION`) — above the 15%
at the top of the base game's range, because it is his headline.

*The bank.* +50% Trade Route income (`EFFECT_CITY_ADJUST_TRADE_YIELD`), +3 Gold per Trade Route,
+1 Trade capacity, and 15% off building purchases.

*Freedom of thought.* +1 Science in every Settlement — deliberately the smallest number on the
sheet; Florence did not fund laboratories, it left Leonardo and Vespucci alone to think.

*Agenda.* **Patron of Workshops**, weighing `DIPLOMACY_AGENDA_COMPARE_NUM_GREAT_WORKS`. Every
shipped leader has an agenda and the AI reads it.

Victory traits: `TRAIT_AQ_ECONOMIC_VICTORY`, `TRAIT_EX_CULTURE_VICTORY`, `TRAIT_MO_CULTURE_VICTORY`.
Leader unlocks: Tuscany in Exploration, America in Modern.

**Art**: same limitation as Porsenna — 2D PNGs we ship, and the 3D model borrowed from
`LEADER_MACHIAVELLI` (a Florentine already in the game) by rewriting the asset name in
`ui/tuscany-images.js`. `BasePersonaType` is kept in step with it but supplies no model of its own.

## 4. Files

Same layout as `Etruscans/` (see [etruscans.md](etruscans.md) §4), with `data/greatpeople.xml` and
`data/greatpeople-gameeffects.xml` added for the Maestro, and the icon basenames prefixed for the
`tuscany` mod id.
