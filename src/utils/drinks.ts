/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * drinks.ts - Consumiciones de la taberna y efectos de sobriedad
 *
 * Define las bebidas y tapas que el jugador puede pedir durante la partida,
 * junto con sus efectos en los niveles de alcohol y cafeína:
 *   - Bebidas con alcohol: caña, vino, carajillo (aumentan alcohol)
 *   - Bebidas con cafeína: café solo (aumenta cafeína)
 *   - Remedios: agua del grifo, gilda (disminuyen alcohol y/o cafeína)
 *
 * Cada consumición tiene:
 *   - Precio (en euros)
 *   - Descripción corta y efecto
 *   - Líneas de diálogo del camarero Manolo al servirla
 *
 * Los niveles de sobriedad (0-5) afectan:
 *   - Las expresiones faciales de los personajes (borracho, cafeinado)
 *   - Los consejos de estrategia del compañero (borracho = faroles, cafeinado = nervioso)
 *   - Los comentarios de voz durante la partida
 */

import { Card, DrinkId, DrinkItem, PlayerSobrietyState } from '../types/mus';
import { evaluateJuego, evaluatePares, getHandHierarchies } from './musRules';

export const TAVERN_DRINKS: DrinkItem[] = [
  {
    id: 'cana',
    name: 'Caña de Mahou Clásica',
    category: 'alcohol',
    icon: '🍺',
    shortDesc: 'Bien tirada con crema',
    effectDesc: '+1 Alcohol | -1 Nerviosismo',
    alcoholDelta: 1,
    caffeineDelta: -1,
    priceTag: '1,40 €',
    waiterLines: [
      '¡Marchando esa cañita bien tirada, con sus dos dedos de crema!',
      '¡Oído cocina! Una rubia fresquita para templar el pulso en la mesa.',
      '¡Aquí tienes, campeón! Con una caña en la mano los envites entran solos.',
      '¡Caña servida! El mus sin un trago de cerveza no tiene la misma gracia.'
    ]
  },
  {
    id: 'vino',
    name: 'Chiquito de Valdepeñas',
    category: 'alcohol',
    icon: '🍷',
    shortDesc: 'Tinto con solera y cuerpo',
    effectDesc: '+1 Alcohol | +1 Valentía desmedida',
    alcoholDelta: 1,
    caffeineDelta: 0,
    priceTag: '1,20 €',
    waiterLines: [
      '¡Un chato de tinto de la bota! ¡Mano de santo para no achantarse al órdago!',
      '¡Aquí va el tinto peleón! Con este vino los ases te van a parecer reyes.',
      '¡Chiquito servido! ¡A ver quién tiene agallas para cortarte el paso!',
      '¡Vino de la casa! ¡Bébetelo despacio que sube al campanario!'
    ]
  },
  {
    id: 'carajillo',
    name: 'Carajillo de Soberano',
    category: 'alcohol',
    icon: '🥃',
    shortDesc: 'Brandy con café de puchero',
    effectDesc: '+1 Alcohol | +1 Cafeína (mezcla explosiva)',
    alcoholDelta: 1,
    caffeineDelta: 1,
    priceTag: '1,80 €',
    waiterLines: [
      '¡Carajillo bien caliente! ¡Esto te pone las pilas y te suelta la lengua!',
      '¡Chorretón de Soberano y café de puchero! ¡Para jugar a cara de perro!',
      '¡Eso es gasolina para el cuerpo! ¡A temblar los rivales!',
      '¡Carajillo de campeonato! ¡Con esto se ganó la Copa del 82!'
    ]
  },
  {
    id: 'cafe',
    name: 'Café Solo de Puchero',
    category: 'caffeine',
    icon: '☕',
    shortDesc: 'Negro, concentrado y sin azúcar',
    effectDesc: '+2 Cafeína | +Atención a señas | +Nerviosismo',
    alcoholDelta: 0,
    caffeineDelta: 2,
    priceTag: '1,10 €',
    waiterLines: [
      '¡Un café solo negro como el tizón! ¡Para no pestañear si el rival hace señas!',
      '¡Café recién colado! Ojo que si tomas mucho te tiemblan hasta las pestañas.',
      '¡Cafetazo para espabilar las neuronas! ¡A calcular los tantos al milímetro!',
      '¡Bien cargado! Con esto cazas las señas hasta de espaldas.'
    ]
  },
  {
    id: 'agua',
    name: 'Vaso de Agua del Grifo de Madrid',
    category: 'remedy',
    icon: '🥤',
    shortDesc: 'Del Canal de Isabel II, la mejor',
    effectDesc: '-1 Alcohol | -1 Cafeína | Despeja la mente',
    alcoholDelta: -1,
    caffeineDelta: -1,
    priceTag: '0,00 €',
    waiterLines: [
      '¡Un vaso de agua del grifo de Madrid! ¡La mejor del mundo entero y gratis!',
      '¡Eso es, un buen trago de agua fresca para despejar la niebla etílica!',
      '¡Mano de santo! Te baja la caraja y te deja la mente como un espejo.',
      '¡Agua del Lozoya fresca! Hay que mantener la cabeza fría en los órdagos.'
    ]
  },
  {
    id: 'tapa',
    name: 'Gilda y Aceitunas Campo Real',
    category: 'remedy',
    icon: '🫒',
    shortDesc: 'Piparra, anchoa y aceituna',
    effectDesc: '-1 Alcohol | Asienta el estómago y aplaca nervios',
    alcoholDelta: -1,
    caffeineDelta: 0,
    priceTag: '1,50 €',
    waiterLines: [
      '¡Una gilda con anchoa del Cantábrico! Asienta el estómago y despeja el juicio.',
      '¡Tapa de aceitunas de Campo Real aliñadas! ¡Que no se diga que en esta taberna se juega en ayunas!',
      '¡Marchando aperitivo! El vinagre de la piparra despierta hasta a un muerto.',
      '¡Para picar entre envite y envite! ¡Esto resucita a cualquiera!'
    ]
  }
];

export function getAlcoholEffectInfo(alcohol: number): { title: string; desc: string; badgeColor: string } {
  if (alcohol <= 0) {
    return {
      title: 'Sobrio como un juez',
      desc: 'Mente despejada, cálculo preciso y prudencia reglamentaria.',
      badgeColor: 'bg-emerald-900/80 text-emerald-200 border-emerald-600'
    };
  }
  if (alcohol === 1) {
    return {
      title: 'Chispilla alegre',
      desc: 'Buen humor tabernero. Desaparece el miedo al envite tímido.',
      badgeColor: 'bg-lime-900/80 text-lime-200 border-lime-600'
    };
  }
  if (alcohol === 2) {
    return {
      title: 'Envalentonado',
      desc: 'Empiezas a sobrestimar la Grande. Aumenta la confianza en cartas medianas.',
      badgeColor: 'bg-amber-900/80 text-amber-200 border-amber-600'
    };
  }
  if (alcohol === 3) {
    return {
      title: 'Chispa cargada',
      desc: 'Ves Reyes donde hay Caballo. Las cartas en mano oscilan con cadencia lo-fi.',
      badgeColor: 'bg-orange-900/80 text-orange-200 border-orange-600'
    };
  }
  if (alcohol === 4) {
    return {
      title: 'Perjudicado de bar',
      desc: 'Cálculos delirantes. Botones transformados con bravuconería castiza.',
      badgeColor: 'bg-red-900/80 text-red-200 border-red-600'
    };
  }
  return {
    title: 'Cantando asturianadas',
    desc: 'Borrachera legendaria de taberna. Todo te parece digno de Órdago.',
    badgeColor: 'bg-purple-900/80 text-purple-200 border-purple-600'
  };
}

export function getCaffeineEffectInfo(caffeine: number): { title: string; desc: string; badgeColor: string } {
  if (caffeine <= 0) {
    return {
      title: 'Pausado',
      desc: 'Ritmo tranquilo de partida sin sobresaltos.',
      badgeColor: 'bg-stone-800 text-stone-300 border-stone-600'
    };
  }
  if (caffeine === 1) {
    return {
      title: 'Despierto',
      desc: '+25% tiempo para cazar señas del rival.',
      badgeColor: 'bg-sky-900/80 text-sky-200 border-sky-600'
    };
  }
  if (caffeine === 2) {
    return {
      title: 'Ojo de lince',
      desc: '+60% tiempo para cazar señas rivales y análisis táctico nítido.',
      badgeColor: 'bg-cyan-900/80 text-cyan-200 border-cyan-600'
    };
  }
  if (caffeine === 3) {
    return {
      title: 'Taquicardia de puchero',
      desc: 'Ligero temblor nervioso en las manos. Impaciencia por ver el descarte.',
      badgeColor: 'bg-amber-900/80 text-amber-200 border-amber-600'
    };
  }
  if (caffeine === 4) {
    return {
      title: 'Como una moto',
      desc: 'Las cartas y botones vibran con nerviosismo. Pulso acelerado.',
      badgeColor: 'bg-rose-900/80 text-rose-200 border-rose-600'
    };
  }
  return {
    title: 'Sobredosis de cafetín',
    desc: 'Temblores descontrolados de dedos. Ganas de cortar el mus de inmediato.',
    badgeColor: 'bg-red-950 text-red-300 border-red-500'
  };
}

/**
 * Transforms action buttons based on player alcohol / caffeine level
 */
export function getBravuraButtonLabel(
  standardText: string,
  actionKey: 'envido' | 'cinco' | 'diez' | 'ordago' | 'quiero' | 'paso' | 'no_quiero',
  alcohol: number,
  caffeine: number
): string {
  // If heavily caffeinated, adds urgency
  const hasUrgency = caffeine >= 4;
  
  if (actionKey === 'ordago') {
    if (alcohol >= 4) return '¡¡ÓRDAGO CIEGO A MUERTE!!';
    if (alcohol >= 3) return '¡¡ÓRDAGO, QUE SE OIGA!!';
    if (alcohol >= 2) return '¡Órdago con dos reaños!';
    return standardText;
  }

  if (actionKey === 'envido') {
    if (alcohol >= 4) return '¡Échale dos por mis muelas!';
    if (alcohol >= 3) return '¡Dos piedras del tirón!';
    if (alcohol >= 2) return '¡Envido dos sin miedo!';
    if (hasUrgency) return '¡Rápido: Envido 2!';
    return standardText;
  }

  if (actionKey === 'cinco') {
    if (alcohol >= 3) return '¡Cinco que nos sobran!';
    if (alcohol >= 2) return '¡Cinco de golpe!';
    return standardText;
  }

  if (actionKey === 'diez') {
    if (alcohol >= 4) return '¡Diez a ver si hay huevos!';
    if (alcohol >= 3) return '¡Diez del ala!';
    return standardText;
  }

  if (actionKey === 'quiero') {
    if (alcohol >= 4) return '¡QUIERO HASTA EL FINAL!';
    if (alcohol >= 2) return '¡Quiero y a por ellos!';
    if (hasUrgency) return '¡Quiero ya!';
    return standardText;
  }

  if (actionKey === 'paso') {
    if (alcohol >= 4) return 'Paso... (si no hay más remedio)';
    if (alcohol >= 3) return 'Paso a regañadientes';
    return standardText;
  }

  if (actionKey === 'no_quiero') {
    if (alcohol >= 4) return '¡No lo quiero por no abusar!';
    if (alcohol >= 3) return 'No lo quiero (me reservo)';
    return standardText;
  }

  return standardText;
}

/**
 * Generates the internal monologue / player tactical advisor.
 * When drunk, calculates horribly and overestimates cards!
 * When caffeinated, calculates ultra-sharp probabilities.
 */
export function getPlayerMentalAssessment(
  cards: Card[],
  alcohol: number,
  caffeine: number
): { text: string; confidence: 'sober' | 'tipsy' | 'drunk' | 'caffeinated' | 'panicked' } {
  if (cards.length === 0) {
    return { text: 'Esperando el reparto de cartas de la mano...', confidence: 'sober' };
  }

  const grande = getHandHierarchies(cards);
  const chica = [...getHandHierarchies(cards)].reverse();
  const pares = evaluatePares(cards);
  const juego = evaluateJuego(cards);
  const punto = { sum: juego.totalSum };

  // If very drunk: Overestimates everything wildly!
  if (alcohol >= 4) {
    const wildComments = [
      '¡Vaya manaza histórica! ¡Con estas cartas le ganamos al mismísimo Marqués de Salamanca!',
      '¡Veo cuatro reyes como cuatro catedrales! ¡Hay que meter órdago a la grande y a la chica!',
      '¡El rey de copas me está guiñando un ojo! ¡Hoy no perdemos ni un amarraco, Manolo pon otra!',
      '¡No sé si son tres reyes o un caballo doblado, pero esto huele a campeonato de España!',
      '¡A mí que no me vengan con chicas ni tontás, aquí se va con todo pa’lante!'
    ];
    return {
      text: wildComments[(cards[0].rank + cards[1].rank + alcohol) % wildComments.length],
      confidence: 'drunk'
    };
  }

  if (alcohol === 3) {
    if (pares.level > 0) {
      return {
        text: '¡Llevamos duples galácticos! (o medias muy buenas). ¡No nos achantamos ni ante la Guardia Civil!',
        confidence: 'drunk'
      };
    }
    if (grande[0] >= 10) {
      return {
        text: '¡Con este Rey no nos tose nadie en la taberna! ¡A envidar fuerte sin complejos!',
        confidence: 'drunk'
      };
    }
    return {
      text: 'Cartas algo flojas... ¡pero con un buen farolazo los dejamos temblando!',
      confidence: 'tipsy'
    };
  }

  if (alcohol === 2) {
    if (juego.hasJuego) {
      return {
        text: `¡Llevamos juego de ${juego.totalSum}! ¡Buen momento para apretar las tuercas al rival!`,
        confidence: 'tipsy'
      };
    }
    return {
      text: 'Mano con soltura. Si ellos muestran duda, les clavamos dos piedras.',
      confidence: 'tipsy'
    };
  }

  // High Caffeine: Hyper-focused or Panicked
  if (caffeine >= 4) {
    return {
      text: '¡EL PULSO ME VA A DOSCIENTOS! ¡Compañero atento al corte, si nos dan mus nos descartamos a la de tres ya!',
      confidence: 'panicked'
    };
  }

  if (caffeine >= 2) {
    let focusNote = '';
    if (pares.level > 0) {
      focusNote = `Pares detectados (${pares.level === 3 ? 'Duples' : pares.level === 2 ? 'Medias' : 'Par'}). `;
    }
    if (juego.hasJuego) {
      focusNote += `Juego óptimo de ${juego.totalSum} puntos. `;
    } else {
      focusNote += `Sin juego, punto de ${punto.sum}. `;
    }
    focusNote += 'Reflejos al 150%: cualquier guiño o mueca rival será detectada al instante.';
    return {
      text: focusNote,
      confidence: 'caffeinated'
    };
  }

  // Normal sober baseline
  let soberAdvice = '';
  if (pares.level === 3) {
    soberAdvice = 'Tenemos Duples. Máxima fuerza en el lance de Pares.';
  } else if (juego.totalSum === 31) {
    soberAdvice = '¡Llevamos 31! El mejor juego posible. Conviene esperar su envite o tirar órdago.';
  } else if (grande[0] === 12 && grande[1] === 12) {
    soberAdvice = 'Dos Reyes en la mano. Gran opción a la Grande.';
  } else if (chica[0] === 1 && chica[1] === 1) {
    soberAdvice = 'Dos Ases. Buena mano para la Chica.';
  } else {
    soberAdvice = 'Mano equilibrada. Observa las señas del compañero antes de arriesgar amarracos.';
  }

  return { text: soberAdvice, confidence: 'sober' };
}

const CHARACTER_DRINK_PREFERENCES: Record<string, DrinkId[]> = {
  // Personalidades: cada personaje pide según su carácter y tolerancia
  cura: ['vino', 'agua', 'tapa', 'vino', 'agua'],          // Pausado, un chatito de tinto y agua
  guardia: ['cafe', 'cafe', 'cana', 'agua', 'tapa'],       // Marcial y alerta, mucho café y alguna caña
  tuno: ['vino', 'carajillo', 'cana', 'vino', 'carajillo'], // Bohemio y juerguista, le da al vino y carajillo
  taxista: ['cafe', 'carajillo', 'cafe', 'cana', 'tapa'],  // Castizo madrileño acelerado: café y carajillo
  tabernera: ['vino', 'tapa', 'cana', 'cafe', 'tapa'],     // Experimentada, alterna vino y tapa
  flamenca: ['vino', 'cana', 'carajillo', 'tapa', 'vino'], // Apasionada y temperamental
  cientifica: ['cafe', 'cafe', 'agua', 'tapa', 'cafe'],    // Analítica, prefiere cafeína para calcular
  chulapa: ['cana', 'vino', 'cafe', 'tapa', 'cana'],       // Pizpireta madrileña, cañita y alguna tapa
};

const CHARACTER_DRINK_CHANCE: Record<string, number> = {
  tuno: 0.62,
  taxista: 0.56,
  flamenca: 0.52,
  chulapa: 0.48,
  guardia: 0.44,
  tabernera: 0.42,
  cientifica: 0.40,
  cura: 0.34,
};

/**
 * Decides whether an NPC wants to order a drink individually on this hand based on personality & state.
 */
export function shouldNpcOrderDrink(characterId: string, current: PlayerSobrietyState): boolean {
  const baseChance = CHARACTER_DRINK_CHANCE[characterId] ?? 0.42;
  // Slightly less eager to keep ordering if already maxed out, unless recovering
  const saturated = current.alcohol >= 4 || current.caffeine >= 4;
  const prob = saturated ? baseChance * 0.65 : baseChance;
  return Math.random() < prob;
}

/**
 * Picks an individual drink for an NPC based on their character personality and current sobriety.
 */
export function pickNpcDrink(characterId: string, current: PlayerSobrietyState): DrinkItem {
  const findDrink = (id: DrinkId): DrinkItem =>
    TAVERN_DRINKS.find((d) => d.id === id) || TAVERN_DRINKS[0];

  // If getting very drunk, most characters order water, tapa, or coffee to recover (tuno/flamenca resist a bit!)
  if (current.alcohol >= 4) {
    const recoveryPool: DrinkId[] =
      characterId === 'tuno' || characterId === 'flamenca'
        ? ['agua', 'tapa', 'cafe', 'carajillo']
        : ['agua', 'tapa', 'agua', 'cafe'];
    const picked = recoveryPool[Math.floor(Math.random() * recoveryPool.length)];
    return findDrink(picked);
  }

  // If already heavily wired on caffeine, cool down with water, a tapa, or a calming beer
  if (current.caffeine >= 4) {
    const calmPool: DrinkId[] =
      characterId === 'taxista' || characterId === 'cientifica'
        ? ['agua', 'tapa', 'agua', 'cana']
        : ['agua', 'tapa', 'cana'];
    const picked = calmPool[Math.floor(Math.random() * calmPool.length)];
    return findDrink(picked);
  }

  const prefs = CHARACTER_DRINK_PREFERENCES[characterId] || ['cana', 'vino', 'cafe', 'tapa'];
  const picked = prefs[Math.floor(Math.random() * prefs.length)];
  return findDrink(picked);
}

/**
 * Authentic individual drink order quote spoken by an NPC to Waiter Manolo.
 */
export function getNpcOrderQuote(characterName: string, drink: DrinkItem): string {
  const linesByDrink: Record<DrinkId, string[]> = {
    cana: [
      '¡Manolo, ponme una cañita bien tirada para mí!',
      'Me pido una caña fresquita, Manolo.',
    ],
    vino: [
      '¡Manolo, échame un chiquito de Valdepeñas!',
      'Para mí un chato de tinto, Manolo.',
    ],
    carajillo: [
      '¡Manolo, un carajillo bien cargado para mí!',
      'Me voy a pedir un carajillo de Soberano, Manolo.',
    ],
    cafe: [
      '¡Manolo, un café solo para despejarme!',
      'Ponme un café de puchero bien negro, Manolo.',
    ],
    agua: [
      '¡Manolo, un vaso de agua fresca para mí!',
      'Me pido un agua del grifo para mantener la cabeza fría.',
    ],
    tapa: [
      '¡Manolo, ponme una gilda con aceitunas para picar!',
      'Me pido unas aceitunas de Campo Real, Manolo.',
    ],
  };

  const options = linesByDrink[drink.id] || [`¡Manolo, ponme ${drink.name} para mí!`];
  void characterName;
  return options[Math.floor(Math.random() * options.length)];
}

