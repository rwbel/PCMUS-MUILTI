/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * shared/characterData.ts - Datos puros de personajes y señas (compatibles con cliente y servidor)
 */

import { Character, FaceRig, MusSign } from '../types/mus';

export const PLAYABLE_CHARACTER_IDS = [
  'cura',
  'guardia',
  'tuno',
  'taxista',
  'tabernera',
  'flamenca',
  'cientifica',
  'chulapa',
] as const;

export type PlayableCharacterId = (typeof PLAYABLE_CHARACTER_IDS)[number];

export const CHARACTER_DATA: Record<string, Character> = {
  cura: {
    id: 'cura',
    name: 'Don Anselmo',
    title: 'El Cura Párroco',
    avatar: '/src/assets/images/pcmus_char_cura_1794392212737.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_cura_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_cura_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_cura_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_cura_top.png',
    gender: 'male',
    description: 'Devoto pero con un ojo clínico para cazar señas y un respeto sagrado por el órdago limpio.',
    voiceStyle: 'Eclesiástico, reflexivo y certero',
    tendency: 'conservative',
    quotes: {
      mus: [
        '¡Mus sea, por caridad y buena fe!',
        'Que Dios bendiga este descarte de prueba.',
        'Hágase el mus y repartamos en paz como buenos hermanos.',
        '¡Musito santo! A ver si viene un As piadoso.',
        '¡Mus! Que el Señor provea cartas más cristianas.'
      ],
      noMus: [
        '¡No hay mus! Dios aprieta pero no ahoga.',
        'Corto el mus, con permiso del Altísimo.',
        '¡Aquí se juega, hermanos, que arrecia la fe!',
        '¡Vaya presencia de mano! No hay mus que valga.',
        '¡Corto! Que luego dicen que los curas somos lentos.'
      ],
      envido: [
        '¡Envido con fe dos piedras!',
        'Pongo dos al cestillo de la parroquia.',
        'Dos más, por las benditas ánimas.',
        '¡A Dios rogando y dos piedras envidando!',
        '¡Envido! Quien no arriesga no cruza el Jordán.'
      ],
      quiero: [
        '¡Quiero y que Dios reparta suerte!',
        'Acepto la prueba, ¡quiero!',
        'Confiemos en la providencia: ¡quiero!',
        '¡Visto y bendecido: quiero!',
        '¡Lo quiero! Que para algo rezamos el rosario.'
      ],
      noQuiero: [
        'La prudencia es virtud cardinal: ¡no quiero!',
        'Líbrenos Dios de esta tentación, no quiero.',
        'Paso de largo por prudencia, ¡no quiero!',
        '¡Vade retro, envite! No lo quiero.',
        'No quiero, que el cepillo parroquial no está para sustos.'
      ],
      ordago: [
        '¡¡ÓRDAGO a mayor gloria de Dios!!',
        '¡Todo el chico a la palestra! ¡ÓRDAGO!',
        '¡Que el cielo decida el pleito! ¡ÓRDAGO!',
        '¡Por las benditas ánimas del purgatorio: ¡¡ÓRDAGO!!',
        '¡Órdago limpio, hermanos! ¡Aquí no hay término medio!'
      ],
      win: [
        'Deo gratias, bien jugado en santa comunión.',
        'La providencia premió la paciencia.',
        'Una bendición de mano, Dios proveerá amarracos.',
        '¡Alabado sea el Señor! Vaya cosecha de piedras.'
      ],
      lose: [
        'El Señor da y el Señor quita... resignación.',
        'Paciencia y penitencia cumplida.',
        'Una mala mano purga los pecados de soberbia.',
        'Ya vendrán tiempos más piadosos, no perdamos la fe.'
      ],
      signReaction: [
        'Entendido, hermano... en el secreto de confesión.',
        'Vi la señal del cielo en tus ojos, compañero.',
        '¡Recibido el mensaje con devoción!'
      ],
      banter: [
        'Si jugáramos al mus en el coro, se llenaba la misa de doce.',
        'El camarero Manolo tiene mano de santo con el hojaldre.',
        'Con dos reyes y un As me atrevo a cruzar el confesionario.'
      ]
    }
  },

  guardia: {
    id: 'guardia',
    name: 'Sargento Rodríguez',
    title: 'La Benemérita',
    avatar: '/src/assets/images/pcmus_char_guardia_1794392227843.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_guardia_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_guardia_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_guardia_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_guardia_top.png',
    gender: 'male',
    description: 'Firme, disciplinado y vigilante como nadie. No tolera faroles flojos ni señas mal disimuladas.',
    voiceStyle: 'Marcial, recto y contundente',
    tendency: 'balanced',
    quotes: {
      mus: [
        '¡Mus concedido reglamentariamente!',
        'Descarte en orden. ¡Procedan con el mus!',
        '¡Mus! Pero sin aspavientos ni corrillos en la barra.',
        'Mus de rigor. La guardia no se precipita jamás.'
      ],
      noMus: [
        '¡¡Alto al mus!! ¡Aquí se juega!',
        'Corto el mus. Atención todo el puesto al lance.',
        '¡No hay mus! Declaramos abierto el envite.',
        '¡Alto ahí! No concedo el mus bajo mi jurisdicción.',
        '¡Se acabó el permiso! ¡Corto!'
      ],
      envido: [
        '¡Envido dos piedras a la orden!',
        'Dos piedras de rigor. ¡Envido!',
        'Subo dos amarracos al atestado.',
        '¡Envido dos! Que conste en acta.',
        '¡Dos piedras! Firmeza ante todo.'
      ],
      quiero: [
        '¡Quiero! ¡A cumplir el deber!',
        '¡Visto y aceptado! ¡Quiero!',
        'No retrocedemos ni un milímetro: ¡quiero!',
        '¡Quiero! ¡Presenten las credenciales!',
        'Aceptado el envite, ¡a la orden!'
      ],
      noQuiero: [
        'Retirada táctica reglamentaria: ¡no quiero!',
        'Negativo al envite: ¡no quiero!',
        'Sin novedad en el frente, no lo quiero.',
        'No lo quiero, prudencia cuartelera.',
        'Desestimo la propuesta, no quiero.'
      ],
      ordago: [
        '¡¡ÓRDAGO por la patria y el honor!!',
        '¡¡Aquí se resuelve todo de golpe: ÓRDAGO!!',
        '¡¡Órdago con todo el peso de la ley!!',
        '¡¡ÓRDAGO directo a la yugular, sin contemplaciones!!',
        '¡¡ÓRDAGO! ¡A ver quién se cuadra primero!!'
      ],
      win: [
        '¡Misión cumplida! Mano impecable y reglamentaria.',
        'Disciplina y cabeza, así se gana en esta demarcación.',
        'Sin novedad en el frente, amarracos al cuartelillo.',
        'Operación de mus culminada con éxito.'
      ],
      lose: [
        'Toca reagruparse y revisar la estrategia.',
        'Aceptamos la derrota con dignidad castrense.',
        'La siguiente mano pasaremos revista a fondo.',
        'Un traspié táctico, pero la guardia nunca se rinde.'
      ],
      signReaction: [
        '¡Recibido el parte cifrado, compañero!',
        'Visto el código por la derecha. Mantén la posición.',
        '¡Anotado en la libreta secreta!'
      ],
      banter: [
        'El que haga señas falsas va a declarar al juzgado de guardia.',
        'Mucho ojo con los faroles que tengo el radar calibrado.',
        'Manolo, ¿ese pastel tiene la ITV en regla?'
      ]
    }
  },

  tuno: {
    id: 'tuno',
    name: 'Clavelito',
    title: 'El Tuno Bohemio',
    avatar: '/src/assets/images/pcmus_char_tuno_1794392242112.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_tuno_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_tuno_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_tuno_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_tuno_top.png',
    gender: 'male',
    description: 'Estudiante eterno de Salamanca. Le encanta farolear, cantar coplas y tirar órdagos con poco miedo.',
    voiceStyle: 'Pícaro, desenfadado y musical',
    tendency: 'bluffer',
    quotes: {
      mus: [
        '¡Mus y que suenen las guitarras!',
        '¡Musito fresco como el rocío de la mañana!',
        '¡Mus alegre para cambiar compás, morena!',
        '¡Mus! Que aún no he afinado la bandurria.'
      ],
      noMus: [
        '¡Corto el mus, que la noche es joven y flamenca!',
        '¡Se acabó el ensayo! ¡No hay mus!',
        '¡A cantar tocan! ¡Corto el mus con salero!',
        '¡No hay mus! Que me hierve la sangre estudiantil.'
      ],
      envido: [
        '¡Envido dos copas de tinto de la casa!',
        '¡Dos piedrecitas para alegrar el fandango!',
        '¡Envido con salero y picardía salmantina!',
        '¡Van dos piedras! ¡Por los ojos de la tabernera!'
      ],
      quiero: [
        '¡Quiero, mi alma, que no se diga que soy cobarde!',
        '¡Por supuesto que lo quiero, y con guitarra!',
        '¡Venga esa apuesta, quiero y ole!',
        '¡Quiero! ¡A mí la legión del amor!'
      ],
      noQuiero: [
        '¡Ay mi clavel, eso no lo quiero!',
        '¡Mejor retirarse y cantar otra copla! No quiero.',
        '¡No quiero, que está el bolsillo tiritando!',
        'Paso de largo, que me guardo la voz para la serenata.'
      ],
      ordago: [
        '¡¡ÓRDAGO a la grande, que viva la bohemia!!',
        '¡¡ÓRDAGO! ¡O me corono o me empeño la capa!!',
        '¡¡Todo al verde! ¡ÓRDAGO, compadre del alma!!',
        '¡¡ÓRDAGO! ¡Que esta ronda la canta el coro entero!!'
      ],
      win: [
        '¡Olé las buenas cartas y la buena racha!',
        '¡A brindar con sangría por este triunfo!',
        '¡Qué bien suena este compás ganador!',
        '¡Victoria! ¡Esta noche hay serenata por todo lo alto!'
      ],
      lose: [
        '¡Vaya serenata desafinada nos ha salido!',
        'No pasa nada, ¡aún nos queda la guitarra y el vino!',
        'Me despistó el brillo de los ojos de Doña Rosa...',
        'Una caída con estilo, compadres.'
      ],
      signReaction: [
        '¡Te pillé el guiño al vuelo, artista!',
        '¡Seña captada, afinemos el acorde!',
        '¡Ese pestañeo ha sido pura poesía!'
      ],
      banter: [
        '¡Estudiante que no fuma ni juega al mus, no es buen tuno!',
        '¡Manolo, ponme otro porrón que se me seca la garganta!',
        'Las mejores señas se aprenden bajo el balcón de una dama.'
      ]
    }
  },

  taxista: {
    id: 'taxista',
    name: 'Don Paco',
    title: 'El Taxista Castizo',
    avatar: '/src/assets/images/pcmus_char_taxista_1794393029237.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_taxista_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_taxista_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_taxista_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_taxista_top.png',
    gender: 'male',
    description: '30 años al volante por la M-30. Conoce todos los atajos de Madrid y todos los faroles del mus.',
    voiceStyle: 'Grave, castizo, rápido y socarrón',
    tendency: 'aggressive',
    quotes: {
      mus: [
        '¡Mus! Que tengo el taxímetro bajado y esto corre.',
        'Musito rápido, como carrera por el Paseo de la Castellana.',
        '¡Mus! A ver si me entra una carrera al aeropuerto.',
        'Venga ese mus, que no tengo todo el turno de noche.'
      ],
      noMus: [
        '¡¡Paro en seco!! ¡No hay mus ni por la vía rápida!',
        '¡Corto el mus! Que en este carril mando yo.',
        '¡No hay mus! Que me he dejado el intermitente puesto para jugar.',
        '¡Corto! Que a mí no me adelantan por la derecha.'
      ],
      envido: [
        '¡Envido dos piedras con suplemento nocturno!',
        '¡Dos piedras! Y no admito tarjeta, todo en mano.',
        '¡Envido dos amarracos al contador!',
        '¡Dos piedras! Como dos atascos en Cibeles.'
      ],
      quiero: [
        '¡Quiero y te lo cobro en la ventanilla!',
        '¡Quiero! Que para atascos los de mi paciencia.',
        '¡Visto y aceptado! ¡Acelero a fondo!',
        '¡Quiero! ¡Que yo no freno con semáforo en ámbar!'
      ],
      noQuiero: [
        '¡No quiero! Que la gasolina está por las nubes.',
        'Eso tiene más baches que la calle Alcalá: no quiero.',
        '¡No quiero, majete! Me desvío por la vía de servicio.',
        'Paso de largo, no me compensa la tarifa.'
      ],
      ordago: [
        '¡¡ÓRDAGO de Chamberí a Vallecas sin paradas!!',
        '¡¡ÓRDAGO! ¡O me forro o me quitan los doce puntos!!',
        '¡¡ÓRDAGO con la bocina a tope!!',
        '¡¡Órdago! ¡Que hoy es viernes y libro el fin de semana!!'
      ],
      win: [
        '¡Carrera redonda y con propina generosa!',
        '¡Así conduce un profesional del volante!',
        '¡Para que aprendáis lo que es el callejero madrileño!',
        '¡Amarracos al bolso y a por la siguiente carrera!'
      ],
      lose: [
        '¡Vaya pinchazo de rueda en mala hora!',
        'Me han pillado en doble fila... qué mala sombra.',
        'No pasa nada, en el siguiente semáforo recuperamos.',
        '¡Vaya viaje de cartas más torcido!'
      ],
      signReaction: [
        '¡Luz verde recibida, socio! Voy por la izquierda.',
        '¡Te he visto el cambio de marcha, compadre!',
        '¡Seña pillada como radar en la M-30!'
      ],
      banter: [
        'En Madrid solo hay dos cosas sagradas: el Real Madrid y el órdago a la grande.',
        'Manolo, ¿a qué hora sale el pastel de la parrilla?',
        'El que no arriesga en Atocha no sale de la glorieta.'
      ]
    }
  },

  tabernera: {
    id: 'tabernera',
    name: 'Doña Rosa',
    title: 'La Tabernera',
    avatar: '/src/assets/images/pcmus_char_tabernera_1794392255914.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_tabernera_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_tabernera_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_tabernera_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_tabernera_top.png',
    gender: 'female',
    description: 'Lleva 40 años sirviendo chatos de vino y viendo partidas de mus. Sabe leer las caras antes de hablar.',
    voiceStyle: 'Cálida, experimentada, aguda y mandona',
    tendency: 'aggressive',
    quotes: {
      mus: [
        '¡Mus y que no falte vino del bueno!',
        'Mus, a ver si entran mejores oros en esta barra.',
        'Venga ese mus calentito mientras Manolo saca las tapas.',
        '¡Musito! Que aún no he cobrado la última ronda.'
      ],
      noMus: [
        '¡Corto el mus! Que aquí venimos a jugar, no a sestear.',
        '¡No hay mus, que se enfría el café con leche!',
        '¡Corto! A ver quién tiene agallas frente a la tabernera.',
        '¡Se acabó el mus! Que me huele a envite del copón.'
      ],
      envido: [
        '¡Envido dos chatos de Valdepeñas!',
        'Dos piedras a la cuenta del bar. ¡Envido!',
        '¡Envido dos! Que no se diga que la patrona es tacaña.',
        '¡Van dos piedras! Y el que no las quiera, a fregar vasos.'
      ],
      quiero: [
        '¡Quiero y te lo sirvo en bandeja de plata!',
        '¡Quiero! Más vale ver que quedarse con la intriga.',
        '¡Quiero, que no nací ayer ni me asustan faroles!',
        '¡Lo quiero! Que en esta casa manda mi mandil.'
      ],
      noQuiero: [
        'No me fío ni un pelo de tu cara: ¡no quiero!',
        'Eso no me gusta cómo huele: no quiero.',
        '¡No quiero! Guardo las piedras para cuando haya parné.',
        '¡Quita, quita! No lo quiero ni en pintura.'
      ],
      ordago: [
        '¡¡ÓRDAGO con la barra entera por delante!!',
        '¡¡ÓRDAGO! ¡Aquí se pagan las deudas al contado!!',
        '¡¡ÓRDAGO! ¡A ver qué lleváis bajo el mandil!!',
        '¡¡ÓRDAGO! ¡Y el que pierda friega los platos de hoy!!'
      ],
      win: [
        '¡Qué bien administradas estas piedras por la patrona!',
        'Para que aprendáis a respetar los galones de la barra.',
        'Ronda pagada con los amarracos ajenos. ¡Salud!',
        '¡Toma castaña! Las cartas las mando yo.'
      ],
      lose: [
        '¡Caramba con la mala suerte! Ya remontaremos en la revancha.',
        'Mejor me voy a servir otro chato para olvidar este lance...',
        'Una mala mano la tiene cualquiera, pero el bar sigue abierto.',
        '¡Vaya tela con las cartas que me habéis dado!'
      ],
      signReaction: [
        '¡Bien visto ese gesto, compañero del alma!',
        'Clarito como el agua fresca del grifo.',
        '¡Seña pillada al vuelo! La patrona no duerme.'
      ],
      banter: [
        'En esta taberna el mus se juega con respeto y con las cartas bien altas.',
        '¡Manolo, atiende a la mesa cuatro que tienen la copa seca!',
        'El secreto del mus es mirar a los ojos y no pestañear jamás.'
      ]
    }
  },

  flamenca: {
    id: 'flamenca',
    name: 'Carmen La Faraona',
    title: 'La Bailaora Flamenca',
    avatar: '/src/assets/images/pcmus_char_flamenca_1794393045041.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_flamenca_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_flamenca_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_flamenca_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_flamenca_top.png',
    gender: 'female',
    description: 'Pura pasión andaluza, taconeo y temperamento. Sus faroles tienen compás de bulería y no teme a nadie.',
    voiceStyle: 'Apasionada, flamenca, rotunda y con duende',
    tendency: 'bluffer',
    quotes: {
      mus: [
        '¡Mus con duende y que toquen las palmas!',
        '¡Musito por soleares, a ver si entra el compás!',
        '¡Mus! Que quiero cambiar de tercio.',
        '¡Mus, cariño! A ver si me viene un Rey con poderío.'
      ],
      noMus: [
        '¡¡Taconeo en la mesa!! ¡No hay mus!',
        '¡Corto el mus por bulerías! ¡Aquí se juega!',
        '¡No hay mus! Que me quema el duende en las venas.',
        '¡Corto, mi rey! Que con esta mano me atrevo a bailar sobre ascuas.'
      ],
      envido: [
        '¡Envido dos piedras con bata de cola!',
        '¡Dos piedrecitas por alegrías de Cádiz!',
        '¡Envido dos! ¡Con tó el arte de Triana!',
        '¡Dos piedras al centro! ¡Que suenen los castañuelas!'
      ],
      quiero: [
        '¡Quiero y te lo bailo en la cara!',
        '¡Quiero, mi vida, que el miedo no baila flamenco!',
        '¡Acepto el envite con orgullo faraónico!',
        '¡Quiero! ¡Que se enteren en toda España de mi casta!'
      ],
      noQuiero: [
        '¡Eso no tiene compás ni soniquete: no quiero!',
        '¡Para esa copla no me levanto del tablao! No quiero.',
        'No lo quiero, mi alma. Me reservo el zapateao.',
        '¡Ay qué desaborío! No lo quiero.'
      ],
      ordago: [
        '¡¡ÓRDAGO por bulerías y con bata de cola!!',
        '¡¡ÓRDAGO de la Faraona! ¡A ver quién me aguanta la mirada!!',
        '¡¡ÓRDAGO! ¡O me llevo el tablao o reviento los tacones!!',
        '¡¡ÓRDAGO, compadre!! ¡Ole, ole y oleee!'
      ],
      win: [
        '¡Ole mi duende y ole mis amarracos!',
        '¡Qué manera de bailar este lance, primores!',
        '¡Así se gana con arte y tronío!',
        '¡Esto se merece una copa de fino y un zapateao!'
      ],
      lose: [
        '¡Vaya quejío amargo me ha quedao en el alma!',
        'Una caída con mantón no mancha el traje.',
        '¡No pasa nada! El flamenco sabe sufrir y levantarse con compás.',
        '¡Qué mal compás han llevado los oros!'
      ],
      signReaction: [
        '¡Vi tu compás en el pestañeo, compañero!',
        '¡Ese guiño tiene más gracia que el coro de Cádiz!',
        '¡Captado al vuelo! ¡Vámonos que nos vamos!'
      ],
      banter: [
        'El mus sin farol es como el flamenco sin taconeo: ¡le falta salero!',
        'A mí no me tiemblan los dedos ni para el órdago ni para el mantón.',
        'Manolo, ¿tienes manzanilla fresca para templar la voz?'
      ]
    }
  },

  cientifica: {
    id: 'cientifica',
    name: 'Dra. Elena',
    title: 'Catedrática de Estadística',
    avatar: '/src/assets/images/pcmus_char_cientifica_1794393060171.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_cientifica_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_cientifica_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_cientifica_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_cientifica_top.png',
    gender: 'female',
    description: 'Calcula probabilidades de 31 y duples al milímetro. Analítica, implacable y con un sentido del humor fino.',
    voiceStyle: 'Intelectual, precisa, irónica y calculadora',
    tendency: 'balanced',
    quotes: {
      mus: [
        'Mus. La probabilidad combinatoria actual aconseja descarte.',
        'Recomiendo mus según la distribución binomial de la baraja.',
        '¡Mus! Estadísticamente los descartes maximizan la esperanza matemática.',
        'Musito prudente. Convergemos hacia el óptimo en la siguiente.'
      ],
      noMus: [
        'Corto el mus. Mi índice de confianza supera el noventa y cinco por ciento.',
        'No hay mus. El análisis bayesiano arroja ventaja clara.',
        'Corto. Jugar con estas cartas es un axioma elemental.',
        '¡No hay mus! Matemáticamente estamos en ventaja empírica.'
      ],
      envido: [
        'Envido dos piedras. El valor esperado es estrictamente positivo.',
        'Añado dos unidades al sumatorio. ¡Envido!',
        'Envido dos. Una hipótesis contrastable que os invito a refutar.',
        'Dos piedras. Ajuste econométrico de rigor.'
      ],
      quiero: [
        'Quiero. Los datos respaldan la toma de decisión.',
        'Acepto. El margen de error cae dentro de parámetros aceptables.',
        '¡Quiero! La varianza está de nuestra parte.',
        'Visto y comprobado. Q.E.D.: ¡quiero!'
      ],
      noQuiero: [
        'No quiero. El riesgo de ruina asimétrica no compensa el premio.',
        'Desestimo la apuesta por divergencia estadística. No quiero.',
        'No lo quiero. Teorema de la prudencia aplicada.',
        'Rechazo formal: el ratio de Sharpe es negativo.'
      ],
      ordago: [
        '¡¡ÓRDAGO!! Determinismo puro: la probabilidad de victoria es abrumadora.',
        '¡¡ÓRDAGO!! Colapso de la función de onda: ¡a resolverlo todo ya!',
        '¡¡ÓRDAGO axiomático!! O ganamos el chico o refutamos la teoría.',
        '¡¡ÓRDAGO!! La correlación entre mis cartas y el triunfo es absoluta.'
      ],
      win: [
        'Demostrado empíricamente: la estadística no engaña.',
        'Como quedó patente en el teorema de mi mano: ganamos.',
        'Previsible y matemáticamente impecable. Amarracos sumados.',
        'Excelente calibración de juego, compañero.'
      ],
      lose: [
        'Una anomalía dentro de la campana de Gauss... fascinante.',
        'Outlier estadístico. Reajustaremos el modelo para la próxima.',
        'El azar tiene estas dispersiones, pero a largo plazo ganaremos.',
        'Error muestral no significativo. Sigamos jugando.'
      ],
      signReaction: [
        'Vector de información recibido y decodificado con éxito.',
        'Seña captada: tus variables encajan en el algoritmo.',
        'Dato procesado. Ajustando estrategia.'
      ],
      banter: [
        'El mus es el único juego donde cuatro sabios discuten por dos garbanzos.',
        'Don Paco conduce rápido, pero mis derivadas son más veloces.',
        'Si los políticos jugaran al mus, aprenderían a no tirar órdagos sin cartas.'
      ]
    }
  },

  chulapa: {
    id: 'chulapa',
    name: 'Conchita La Chulapa',
    title: 'La Chulapa Castiza',
    avatar: '/src/assets/images/pcmus_char_chulapa_1794393074738.jpg',
    seatedAvatar: '/src/assets/images/pcmus_sprite_chulapa_top.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_chulapa_left.png',
    seatedRight: '/src/assets/images/pcmus_sprite_chulapa_right.png',
    seatedTop: '/src/assets/images/pcmus_sprite_chulapa_top.png',
    gender: 'female',
    description: 'De Chamberí de toda la vida. Rápida con la réplica, pizpireta y con más chispa que las verbenas de San Isidro.',
    voiceStyle: 'Castiza madrileña, dicharachera, cantarina y vivaz',
    tendency: 'aggressive',
    quotes: {
      mus: [
        '¡Mus, chulapo mío! Que aún no me he colocado el clavel.',
        '¡Musito fino como organillo en la pradera!',
        '¡Mus, a ver si me viene un As con mantón!',
        'Venga ese mus, que no se diga que en Madrid tenemos prisa.'
      ],
      noMus: [
        '¡¡Quieto parao, chulapo!! ¡No hay mus!',
        '¡Corto el mus! Que en la verbena de Chamberí se baila pegao.',
        '¡No hay mus! Que tengo unas cartas más pintureras que San Isidro.',
        '¡Corto! A ver quién le tose a esta chulapa.'
      ],
      envido: [
        '¡Envido dos chatos de limonada madrileña!',
        '¡Dos piedras, moreno! Que no se te atragante el barquillo.',
        '¡Envido dos! Con más salero que el rastro en domingo.',
        '¡Dos piedras al bote! ¡Y olé las madrileñas guapas!'
      ],
      quiero: [
        '¡Quiero, pichirichi! ¡A mí no me achantas con farolitos!',
        '¡Quiero y te echo un chotis en la mesa!',
        '¡Visto y aceptado! ¡Que viva Madrid y sus cartas!',
        '¡Quiero! ¡Que para sustos ya tengo a mi suegra!'
      ],
      noQuiero: [
        '¡Eso no te lo quiero ni regalado con barquillos!',
        '¡Anda y que te ondulen la permanente! No quiero.',
        'No quiero, majo. Con esa cara no me convences.',
        '¡Paso de largo, moreno! Que no me fío de tu sonrisita.'
      ],
      ordago: [
        '¡¡ÓRDAGO de la Puerta de Alcalá a la Cibeles!!',
        '¡¡ÓRDAGO con mantón de Manila y zapatillas de charol!!',
        '¡¡ÓRDAGO, chulapos!! ¡A ver quién tiene reaños en Madrid!!',
        '¡¡ÓRDAGO! ¡Que se pare el organillo y empiece la fiesta!!'
      ],
      win: [
        '¡Toma y daca! ¡Así se gana en Chamberí con gracia y garbo!',
        '¡Ole las chulapas de bandera! Amarracos para el mantón.',
        '¡Qué bien suena este chotis ganador!',
        '¡Para que presumáis de jugar al mus con la Conchita!'
      ],
      lose: [
        '¡Vaya trompazo en la verbena! Ya me desquitaré.',
        'Se me ha torcido el clavel... pero el orgullo lo tengo intacto.',
        '¡Qué cartas más sosas! Ni para envolver churros sirven.',
        'En la próxima mano vais a ver lo que es bueno.'
      ],
      signReaction: [
        '¡Ese guiño lo he visto hasta con el mantón puesto!',
        '¡Pillada la seña, pichirichi! Vamos a por ellos.',
        '¡Clarito como un vaso de agua de Lozoya!'
      ],
      banter: [
        'Madrid al anochecer huele a jazmín, a barquillos y a órdago a la chica.',
        'Manolo, sácame unas aceitunas de campo real que esto da hambre.',
        'El que no sabe perder al mus no merece llamarse castizo.'
      ]
    }
  },

  camarero: {
    id: 'camarero',
    name: 'Manolo',
    title: 'El Camarero Castizo',
    avatar: '/src/assets/images/pcmus_sprite_camarero.png',
    seatedAvatar: '/src/assets/images/pcmus_sprite_camarero.png',
    seatedLeft: '/src/assets/images/pcmus_sprite_camarero.png',
    seatedRight: '/src/assets/images/pcmus_sprite_camarero.png',
    seatedTop: '/src/assets/images/pcmus_sprite_camarero.png',
    gender: 'male',
    description: 'Camarero mayor del bar. Sirve el pastel del día recién horneado y mantiene la calma en los órdagos.',
    voiceStyle: 'Castizo, socarrón, cantarín y hospitalario',
    tendency: 'balanced',
    quotes: {
      mus: [
        '¡Vaya presencia de pastel, vaya presencia!',
        '¡Marchando dos cañas bien tiradas con su espuma de crema!',
        '¡Si hay mus, da tiempo a calentar el café de puchero!',
        '¡Atención a la bandeja que quema el hojaldre recién salido!',
        '¡Un poco de mus viene bien para reponer los vasos vacíos!'
      ],
      noMus: [
        '¡Cortan el mus! Se anima el ambiente en la taberna.',
        '¡A jugar tocan, marchando una de bravas bien picantes!',
        '¡No hay mus, que se enfría el puchero de la patrona!',
        '¡Atención parroquianos, que aquí no se regala nada!'
      ],
      envido: [
        '¡Dos piedras a la mesa del fondo! ¡Que corra el vino de la casa!',
        '¡Sube la apuesta, que esto huele a semifinal de copa!',
        '¡Dos amarracos de propina para el que acierte!'
      ],
      quiero: [
        '¡Oído cocina, lance aceptado con bravura y sin temblores!',
        '¡Quieren la apuesta! ¡Esto está más emocionante que el derby!'
      ],
      noQuiero: [
        '¡Se retiran a tiempo! Más vale pájaro en mano que amarraco volando.',
        '¡Sensatez castiza, señorías!'
      ],
      ordago: [
        '¡¡SILENCIO EN LA SALA, HAN TIRADO UN ÓRDAGO!!',
        '¡¡Órdago en el Madroño! ¡Paren la gramola y cierren el grifo!!',
        '¡¡Madre del amor hermoso, qué órdago más pintón!!',
        '¡¡Que no vuele ni una mosca, que esto se decide aquí mismo!!'
      ],
      win: [
        '¡Bravo por los ganadores! Tienen barra libre de sonrisas y aplausos.',
        '¡Menuda jugada, ni en el campeonato de Lavapiés!',
        '¡Qué mano de mus más redonda, caballero!'
      ],
      lose: [
        '¡Ánimo muchachos, que la taberna nunca cierra para los valientes!',
        '¡A la próxima os sale el juego de 31!',
        '¡Un chato de tinto y a volver a empezar!'
      ],
      signReaction: [
        '¡Esa seña la ha visto hasta la máquina de discos!',
        '¡Mucho ojo con pestañear tanto que Manolo todo lo ve!'
      ],
      banter: [
        'El pastel de hojaldre de hoy está para ponerle un piso en la Gran Vía.',
        'Llevo 35 años tras esta barra y jamás vi un órdago tan bien plantado.'
      ]
    }
  }
};

export const AUTHENTIC_MUS_SIGNS: MusSign[] = [
  {
    id: 'labio',
    name: 'Morder el Labio Inferior',
    gesture: 'Morderse el centro del labio inferior',
    meaning: 'Dos Reyes (o dos Treses) · Art. II Reg. Bizkaia',
    icon: '👄',
    requiredCondition: '2 Reyes'
  },
  {
    id: 'lengua',
    name: 'Punta de la Lengua',
    gesture: 'Sacar la punta de la lengua por el centro de la boca',
    meaning: 'Dos Ases (o dos Doses) · Art. II Reg. Bizkaia',
    icon: '👅',
    requiredCondition: '2 Ases'
  },
  {
    id: 'cejas',
    name: 'Levantar las Cejas',
    gesture: 'Levantar ambas cejas',
    meaning: 'Duples (póker o dos parejas) · Art. II Reg. Bizkaia',
    icon: '🤨',
    requiredCondition: 'Duples'
  },
  {
    id: 'boca_lado',
    name: 'Comisura de Labios',
    gesture: 'Mover la comisura de los labios hacia un lado',
    meaning: 'Medias (trío de reyes o cualquier carta) · Art. II Reg. Bizkaia',
    icon: '😏',
    requiredCondition: 'Medias'
  },
  {
    id: 'guino',
    name: 'Guiñar un Ojo',
    gesture: 'Guiñar un ojo disimuladamente',
    meaning: 'Treinta y Una de Juego (31) · Art. II Reg. Bizkaia',
    icon: '😉',
    requiredCondition: '31 de Juego'
  },
  {
    id: 'ciego',
    name: 'Cerrar los Dos Ojos',
    gesture: 'Cerrar ambos ojos con suavidad (ceguera)',
    meaning: 'Ciego (sin pares, ni juego ni 29) · Art. II Reg. Bizkaia',
    icon: '😌',
    requiredCondition: 'Ciego'
  }
];

export function getSignAnimationClass(signIconOrId?: string | null): string {
  if (!signIconOrId) return 'animate-sign-pop';
  if (signIconOrId === 'labio' || signIconOrId.includes('👄')) return 'animate-sign-lip';
  if (signIconOrId === 'guino' || signIconOrId.includes('😉')) return 'animate-sign-wink';
  if (signIconOrId === 'lengua' || signIconOrId.includes('👅')) return 'animate-sign-tongue';
  if (signIconOrId === 'boca_lado' || signIconOrId.includes('😏')) return 'animate-sign-smirk';
  if (signIconOrId === 'cejas' || signIconOrId.includes('🤨')) return 'animate-sign-eyebrows';
  if (signIconOrId === 'ciego' || signIconOrId.includes('😌') || signIconOrId.includes('🙄')) {
    return 'animate-sign-closed';
  }
  return 'animate-sign-pop';
}

export const FACE_RIGS: Record<string, FaceRig> = {
  camarero_top:     { cx: 53.5, eyeY: 22.3, eyeDx: 5.5, eyeW: 20.5, mouthX: 53.8, mouthY: 36.0, mouthW: 18.0, skin: '#efb28c' },

  cura_left:        { cx: 51.8, eyeY: 17.8, eyeDx: 7.5, eyeW: 23.5, mouthX: 50.2, mouthY: 31.0, mouthW: 22.0, skin: '#f3b793' },
  cura_top:         { cx: 50.0, eyeY: 16.5, eyeDx: 6.2, eyeW: 23.5, mouthX: 50.0, mouthY: 33.4, mouthW: 22.0, skin: '#f3b793' },
  cura_right:       { cx: 49.2, eyeY: 17.8, eyeDx: 5.5, eyeW: 23.5, mouthX: 49.8, mouthY: 31.0, mouthW: 22.0, skin: '#f3b793' },

  guardia_left:     { cx: 52.6, eyeY: 18.8, eyeDx: 4.0, eyeW: 14.8, mouthX: 52.5, mouthY: 26.8, mouthW: 16.5, skin: '#eaa77f' },
  guardia_top:      { cx: 50.0, eyeY: 16.8, eyeDx: 5.5, eyeW: 18.5, mouthX: 50.0, mouthY: 26.0, mouthW: 16.5, skin: '#eaa77f' },
  guardia_right:    { cx: 51.2, eyeY: 18.8, eyeDx: 8.0, eyeW: 12.8, mouthX: 50.5, mouthY: 29.8, mouthW: 11.5, skin: '#eaa77f' },

  tuno_left:        { cx: 51.8, eyeY: 19.6, eyeDx: 3.8, eyeW: 11.8, mouthX: 52.0, mouthY: 27.4, mouthW: 10.5, skin: '#eda982' },
  tuno_top:         { cx: 50.0, eyeY: 19.3, eyeDx: 5.0, eyeW: 16.5, mouthX: 50.0, mouthY: 25.4, mouthW: 14.5, skin: '#eda982' },
  tuno_right:       { cx: 44.5, eyeY: 18.6, eyeDx: 4.8, eyeW: 13.8, mouthX: 46.0, mouthY: 25.4, mouthW: 12.5, skin: '#eda982' },

  taxista_left:     { cx: 49.5, eyeY: 21.4, eyeDx: 4.2, eyeW: 15.0, mouthX: 49.8, mouthY: 31.8, mouthW: 12.0, skin: '#eba880' },
  taxista_top:      { cx: 50.0, eyeY: 19.6, eyeDx: 5.8, eyeW: 19.5, mouthX: 50.0, mouthY: 29.8, mouthW: 17.0, skin: '#eba880' },
  taxista_right:    { cx: 50.5, eyeY: 21.4, eyeDx: 4.2, eyeW: 13.0, mouthX: 50.2, mouthY: 31.8, mouthW: 12.0, skin: '#eba880' },

  tabernera_left:   { cx: 50.2, eyeY: 20.6, eyeDx: 14.8, eyeW: 15.0, mouthX: 49.2, mouthY: 28.8, mouthW: 18.0, skin: '#efb38e' },
  tabernera_top:    { cx: 50.0, eyeY: 20.0, eyeDx: 5.2, eyeW: 17.5, mouthX: 50.0, mouthY: 28.2, mouthW: 19.0, skin: '#efb38e' },
  tabernera_right:  { cx: 49.8, eyeY: 20.6, eyeDx: -2.8, eyeW: 15.0, mouthX: 49.8, mouthY: 28.8, mouthW: 18.0, skin: '#efb38e' },

  flamenca_left:    { cx: 52.6, eyeY: 17.4, eyeDx: 3.6, eyeW: 11.6, mouthX: 52.6, mouthY: 24.8, mouthW: 10.5, skin: '#efb38e' },
  flamenca_top:     { cx: 48.6, eyeY: 18.2, eyeDx: 3.8, eyeW: 14.6, mouthX: 48.6, mouthY: 24.4, mouthW: 13.5, skin: '#efb38e' },
  flamenca_right:   { cx: 42.4, eyeY: 17.4, eyeDx: 2.6, eyeW: 13.6, mouthX: 42.4, mouthY: 22.8, mouthW: 10.5, skin: '#efb38e' },

  cientifica_left:  { cx: 50.1, eyeY: 20.4, eyeDx: 3.6, eyeW: 11.4, mouthX: 49.4, mouthY: 27.2, mouthW: 10.5, skin: '#f1b997' },
  cientifica_top:   { cx: 50.0, eyeY: 19.2, eyeDx: 4.8, eyeW: 16.2, mouthX: 50.0, mouthY: 24.5, mouthW: 14.0, skin: '#f1b997' },
  cientifica_right: { cx: 49.9, eyeY: 20.4, eyeDx: 3.6, eyeW: 11.4, mouthX: 50.6, mouthY: 27.2, mouthW: 10.5, skin: '#f1b997' },

  chulapa_left:     { cx: 41.2, eyeY: 19.5, eyeDx: 3.5, eyeW: 11.2, mouthX: 41.5, mouthY: 26.0, mouthW: 10.0, skin: '#f0b796' },
  chulapa_top:      { cx: 50.0, eyeY: 18.2, eyeDx: 4.6, eyeW: 15.4, mouthX: 50.0, mouthY: 24.4, mouthW: 13.2, skin: '#f0b796' },
  chulapa_right:    { cx: 58.8, eyeY: 19.5, eyeDx: 3.5, eyeW: 11.2, mouthX: 58.5, mouthY: 26.0, mouthW: 10.0, skin: '#f0b796' },
};
