// ============================================================
//  LUMENCARE BOT ENGINE v2
//  Acompañamiento emocional con memoria de nombre,
//  lenguaje natural variado y ejercicios guiados
// ============================================================

// ─── PALABRAS DE CRISIS Y ALERTA ─────────────────────────────────────────────

const PALABRAS_CRISIS = [
    'suicidio','suicidarme','matarme','matar me','quiero morir',
    'no quiero vivir','no vale la pena vivir','mejor muerto','mejor muerta',
    'quitarme la vida','hacerme daño','lastimarme','cortarme',
    'pastillas para morir','overdose','sobredosis','quisiera no existir',
];

const PALABRAS_ALERTA = [
    'me quiero morir','ya no puedo más','no puedo seguir','no hay salida',
    'todo está mal','nadie me entiende','me siento vacío','me siento vacía',
    'no sirvo para nada','soy un fracaso','odio mi vida','ya no aguanto',
    'no tiene sentido','para qué seguir',
];

// ─── PALABRAS CLAVE POR INTENCIÓN ────────────────────────────────────────────

const INTENCIONES = {
    saludo:       ['hola','buenas','buenos días','buenas tardes','buenas noches','hey','hi','qué tal','como estas','cómo estás','ey'],
    estres:       ['estrés','estres','estresado','estresada','agobiado','agobiada','saturado','saturada','mucho trabajo','no puedo con todo','demasiado','presión','presion','carga','overwhelm'],
    ansiedad:     ['ansioso','ansiosa','ansiedad','nervioso','nerviosa','nervios','angustia','angustiado','me tiembla','corazón acelerado','no puedo respirar','me ahogo','pánico','panico','ataque de pánico'],
    tristeza:     ['triste','tristeza','llorar','lloro','llorando','deprimido','deprimida','depresión','depresion','no tengo ganas','sin ganas','vacío','vacía','melancolía','me siento mal','muerte','falleció','murió','duelo','pérdida','extraño a','extrañar','me hace falta'],
    soledad:      ['solo','sola','soledad','sin amigos','me ignoran','no tengo a nadie','aislado','aislada','excluido','excluida','invisible'],
    escuela:      ['examen','exámenes','tarea','calificación','calificaciones','reprobar','reprobé','escuela','universidad','maestro','profesor','materia','parcial','ipn','politécnico'],
    tiempo:       ['procrastino','procrastinando','no me da el tiempo','no rindo','me distraigo','distracción','no termino','pendientes','atrasado','atrasada','no avanzo','no me concentro','organizar','organización'],
    sueno:        ['dormir','no puedo dormir','insomnio','me desvelo','desvelado','desvelada','no duermo','pesadilla','pesadillas','mal sueño','cansado','cansada','agotado','agotada','sin energía','siempre tengo sueño'],
    relaciones:   ['pelea','peleé','discusión','discutí','mi novio','mi novia','mi pareja','mi amigo','mi amiga','me traicionaron','me fallaron','confianza','celos','me rechazaron','ruptura','terminé','terminamos','me lastimaron','me ignoran','me excluyen'],
    autoestima:   ['no soy suficiente','no valgo','me odio','inseguro','insegura','inseguridad','no me quiero','baja autoestima','no confío en mí','siempre me equivoco','todos son mejores','me comparo'],
    respiracion:  ['respiración','respiracion','ejercicio de respiración','respirar','técnica','tecnica','relajarme','calmarme','tranquilizarme','4-7-8'],
    meditacion:   ['meditación','meditacion','meditar','quiero meditar','mente en paz','paz mental','silenciar la mente','mindfulness','atención plena'],
    visualizacion:['visualización','visualizacion','visualizar','imaginar un lugar','lugar seguro','imaginación guiada'],
    gratitud:     ['gracias','me ayudó','me ayudo','me siento mejor','funcionó','funciono','adiós','adios','hasta luego','chao','bye'],
};

// ─── ESTADO DE CONVERSACIÓN ───────────────────────────────────────────────────

const estadoConversaciones = new Map();

function getEstado(id) {
    if (!estadoConversaciones.has(id)) {
        estadoConversaciones.set(id, {
            fase:              'inicial',
            temaActual:        null,
            ejercicioActual:   null,
            pasoEjercicio:     0,
            mensajesCount:     0,
            moodUsuario:       null,
            nombre:            null,
            preguntadoNombre:  false,
            // ── MEMORIA DE SESIÓN ─────────────────────────────────────────
            temasDiscutidos:   [],   // temas explorados en esta sesión
            ejerciciosHechos:  [],   // ejercicios completados
            feedbackEjercicios:{},   // { nombreEjercicio: 'mejor'|'igual'|'peor' }
            contexto:          [],   // frases clave mencionadas por el usuario
        });
    }
    return estadoConversaciones.get(id);
}

function set(id, cambios) {
    Object.assign(getEstado(id), cambios);
}

// Helper: retorna ", {nombre}" si hay nombre guardado, o ""
function n(estado) {
    return estado.nombre ? `, ${estado.nombre}` : '';
}

// ─── RESPUESTAS DE CRISIS ─────────────────────────────────────────────────────

const CRISIS_MSG = `Lo que sientes en este momento importa, y tú importas. No tienes que cargarlo solo/a.

📞 **Línea de la Vida: 800 290 0024**
Gratuita · Confidencial · 24 horas · 365 días

Hay personas capacitadas esperando escucharte ahora mismo. ¿Puedes marcar ese número?`;

const ALERTA_MSGS = [
    `Eso que describes suena muy pesado, y tiene todo el sentido que te afecte.

Cuéntame más... ¿desde cuándo te sientes así? Estoy aquí sin juzgarte.

_(Y si en algún momento sientes que necesitas apoyo urgente, recuerda que la **Línea de la Vida: 800 290 0024** está disponible las 24 horas.)_`,
    `Me alegra que lo estés expresando. No tienes que guardártelo.

¿Qué ha estado pasando? Puedes contarme a tu ritmo.

_(Si en algún momento lo necesitas: **Línea de la Vida 800 290 0024**, siempre disponible.)_`,
];

// ─── RESPUESTAS POR TEMA ──────────────────────────────────────────────────────

const R = {

    saludo: {
        sinNombre: [
            `¡Hola! Qué bueno que estás aquí. 💜\n\nAntes de comenzar, ¿cómo te gustaría que me dirija a ti? Puedes decirme tu nombre, apodo, o simplemente cómo prefieras.`,
            `Hola, bienvenido/a. Me alegra que hayas abierto este espacio.\n\n¿Cómo te llamas o cómo prefieres que te llame?`,
            `¡Hey! Estoy aquí para acompañarte. 😊\n\n¿Cómo quieres que me refiera a ti?`,
        ],
        conNombre: (nombre, mood) => {
            const moodMsg = {
                ansioso:     `Noté que hoy te has sentido ansioso/a, ${nombre}. ¿Quieres contarme qué está pasando, o prefieres que hagamos algo para calmarte?`,
                agobiado:    `Parece que has tenido un día pesado, ${nombre}. ¿Qué es lo que más te está pesando?`,
                triste:      `Hola, ${nombre}. Noto que hoy no ha sido fácil. No tienes que estar bien todo el tiempo — ¿quieres hablar?`,
                desesperado: `Hola, ${nombre}. Me alegra que hayas abierto este espacio. ¿Cómo estás en este momento?`,
                euforico:    `¡${nombre}! Qué bueno verte con tanta energía. 🌟 ¿Qué te tiene así de animado/a?`,
                contento:    `¡Hola, ${nombre}! Se nota que hoy ha sido un buen día. 😊 ¿En qué te puedo acompañar?`,
                tranquilo:   `Hola, ${nombre}. Qué bueno que estés tranquilo/a. ¿Hay algo en lo que te pueda ayudar hoy?`,
                neutral:     `Hola, ${nombre}. ¿Cómo estás hoy? Estoy aquí para lo que necesites.`,
            };
            return moodMsg[mood] || `¡Hola de nuevo, ${nombre}! 😊 ¿Cómo estás hoy? Cuéntame.`;
        },
    },

    nombre_recibido: (nombre) => [
        `Mucho gusto, ${nombre}. 😊 Este es un espacio seguro para ti.\n\n¿Cómo estás hoy? ¿Hay algo que te haya traído por aquí?`,
        `¡${nombre}! Qué bueno conocerte. Estoy aquí para escucharte.\n\n¿Cómo te has sentido últimamente?`,
        `Gracias por contarme, ${nombre}. Así me será más fácil acompañarte.\n\n¿Cómo estás? ¿Hay algo que quieras platicar?`,
    ],

    estres: {
        exploracion: [
            (n) => `El estrés puede ser agotador${n}, especialmente cuando sientes que todo se acumula al mismo tiempo.\n\n¿Qué es lo que más te está pesando ahorita? ¿Es la escuela, el trabajo, las relaciones... o una mezcla de todo?`,
            (n) => `Cuando estamos saturados${n}, hasta respirar se siente difícil.\n\n¿Hay algo específico que está generando esa presión, o es un cansancio acumulado de varios frentes?`,
            (n) => `Entiendo perfectamente esa sensación${n}. ¿Desde cuándo se ha estado acumulando esto? ¿Llevas días así o llegó de repente?`,
        ],
        validacion: [
            (n) => `Tiene mucho sentido que te sientas así${n} con todo lo que describes. No eres débil — cualquiera se satura cuando la carga es demasiada.`,
            (n) => `Lo que describes es genuinamente difícil${n}. Y está bien nombrarlo.`,
            (n) => `No tienes que poder con todo${n}. Reconocer el límite ya es un paso importante.`,
        ],
        oferta: (n) => `¿Sabes qué${n}? A veces cuando estamos tan cargados, una pausa corta hace más que seguir empujando. Hay un ejercicio de respiración que tarda menos de 5 minutos y baja bastante esa tensión. ¿Lo intentamos?`,
    },

    ansiedad: {
        exploracion: [
            (n) => `La ansiedad puede sentirse muy intensa${n}, como si el cuerpo entrara en modo alarma sin que puedas apagarlo.\n\n¿Estás sintiendo algo físico ahorita — corazón acelerado, tensión en el pecho, o dificultad para respirar?`,
            (n) => `Esa sensación de nervios que no se van puede ser muy desgastante${n}.\n\n¿Sabes qué lo está desencadenando, o aparece sin razón aparente?`,
            (n) => `Entiendo${n}. ¿Es una ansiedad que llevas días sintiendo, o fue algo que pasó hoy que la detonó?`,
        ],
        validacion: [
            (n) => `La ansiedad es real${n}, y lo que sientes es válido. No es imaginación ni exageración.`,
            (n) => `Muchas personas pasan por esto${n}. No estás roto/a ni solo/a en ello.`,
            (n) => `Tu cuerpo está tratando de protegerte${n}, aunque no siempre lo hace de la manera más útil. Lo que sientes tiene una razón.`,
        ],
        oferta: (n) => `Tengo una técnica que ayuda bastante cuando la ansiedad se intensifica${n}. Se llama respiración 4-7-8 y activa el sistema nervioso para calmarte en minutos. ¿La intentamos?`,
    },

    tristeza: {
        exploracion: [
            (n) => `La tristeza a veces llega sin avisar${n}, y otras veces tiene una razón muy clara.\n\n¿Sabes qué es lo que la está generando, o es más una sensación que no sabes bien de dónde viene?`,
            (n) => `Gracias por contarme${n}. ¿Desde cuándo te has sentido así? ¿Llevas varios días o es algo de hoy?`,
            (n) => `Entiendo${n}. ¿Hay algo que haya pasado recientemente, o es un peso que ya llevas un tiempo cargando?`,
        ],
        validacion: [
            (n) => `Está bien sentirse triste${n}. No tienes que forzarte a estar bien.`,
            (n) => `La tristeza es una emoción completamente válida${n}. Acompañarla con amabilidad es más útil que intentar ignorarla.`,
            (n) => `No tienes que resolver esto rápido${n}. Solo estar aquí ya es suficiente por ahora.`,
        ],
        oferta: (n) => `Cuando estamos tristes${n}, conectar con el cuerpo puede traer un pequeño alivio. ¿Quieres que hagamos una meditación corta juntos? No tienes que hacer nada — solo seguir mi voz.`,
    },

    soledad: {
        exploracion: [
            (n) => `La soledad duele de una manera muy particular${n}.\n\n¿Es estar físicamente solo/a, o más bien sentir que nadie te entiende aunque estés rodeado/a de gente?`,
            (n) => `Entiendo${n}. ¿Hay alguien en tu vida con quien puedas hablar sobre cómo te sientes, o sientes que no tienes a nadie?`,
            (n) => `Eso que describes es más común de lo que parece${n}, aunque cuando lo vivimos se siente como si fuéramos los únicos. ¿Cuándo empezaste a sentirte así?`,
        ],
        validacion: [
            (n) => `Sentirse solo/a en medio de muchas personas es una de las experiencias más difíciles${n}. Y es más frecuente de lo que imaginamos.`,
            (n) => `Que estés aquí contándome esto ya es un acto de valentía${n}. No tienes que cargarlo solo/a.`,
            (n) => `Tu necesidad de conexión es completamente válida${n}. Todos la tenemos.`,
        ],
        oferta: (n) => `Cuando nos sentimos solos${n}, reconectar con nosotros mismos puede traer algo de alivio. ¿Te gustaría hacer una visualización guiada? Te voy a llevar a un lugar donde puedas sentirte en paz.`,
    },

    escuela: {
        exploracion: [
            (n) => `La presión académica en el Poli puede ser muy intensa${n}.\n\n¿Qué está pasando — son los exámenes, las entregas, los maestros, o sientes que simplemente no puedes con todo?`,
            (n) => `Entiendo${n}. ¿Es una materia en particular o es todo en general lo que se siente abrumador?`,
            (n) => `¿Esto que describes${n} es algo nuevo o llevas un tiempo sintiéndote así con la escuela?`,
        ],
        validacion: [
            (n) => `La carga académica del IPN es real y reconocida${n}. No estás exagerando.`,
            (n) => `Muchos estudiantes pasan por lo mismo que describes${n}. No significa que no seas capaz.`,
            (n) => `Sentirte así no dice nada malo de ti${n}. El sistema exige mucho y no siempre da las herramientas para manejarlo.`,
        ],
        oferta: (n) => `Antes de pensar en estrategias${n}, ¿cómo está tu cuerpo ahorita? El estrés académico se acumula físicamente. ¿Hacemos un ejercicio rápido para liberar esa tensión?`,
    },

    tiempo: {
        exploracion: [
            (n) => `La sensación de que el tiempo no alcanza puede ser muy frustrante${n}.\n\n¿Qué es lo que más te cuesta — empezar las cosas, terminarlas, o sientes que tienes demasiado y no sabes por dónde?`,
            (n) => `Entiendo${n}. ¿Hay algo específico que estás evitando, o es una sensación general de que nada avanza?`,
            (n) => `La procrastinación y la falta de concentración muchas veces son señales de algo más${n}. ¿Cómo te has sentido emocionalmente estos días?`,
        ],
        validacion: [
            (n) => `Muchos estudiantes pasan exactamente por eso${n}. Muchas veces la procrastinación no es flojera — es agotamiento mental o ansiedad disfrazada.`,
            (n) => `La dificultad para organizarse no dice nada malo de ti${n}. El cerebro bajo presión tiene menos capacidad ejecutiva. Es biología, no carácter.`,
            (n) => `No eres el problema${n}. A veces el sistema nos pone en situaciones que no cualquier mente puede manejar sola.`,
        ],
        oferta: (n) => `Antes de hablar de estrategias${n}, ¿cómo está tu cuerpo en este momento? A veces una pausa consciente de 5 minutos hace más que seguir forzando. ¿Lo intentamos?`,
    },

    sueno: {
        exploracion: [
            (n) => `Los problemas de sueño afectan todo${n} — el humor, la concentración, las emociones.\n\n¿Qué es lo que pasa exactamente? ¿No puedes quedarte dormido/a, te despiertas en la noche, o simplemente sientes que no descansas bien?`,
            (n) => `Entiendo${n}. ¿Desde cuándo está pasando esto? ¿Hay algo que notes que lo desencadena — como el estrés, los pensamientos en la noche, o algo más?`,
            (n) => `¿Cómo son tus noches${n}? ¿Puedes describir qué pasa cuando intentas dormir?`,
        ],
        validacion: [
            (n) => `El insomnio y el mal sueño son más comunes de lo que parece${n}, y tienen un impacto real en cómo nos sentimos. No estás exagerando.`,
            (n) => `Cuando el cuerpo no descansa${n}, todo se siente más difícil. Tiene mucho sentido que te afecte así.`,
            (n) => `El sueño es fundamental para el bienestar emocional${n}. Que esto te esté costando es algo importante de atender.`,
        ],
        oferta: (n) => `Hay una técnica que puede ayudar a preparar el cuerpo y la mente para el descanso${n}. Se llama relajación muscular progresiva y muchas personas la usan justo antes de dormir. ¿La aprendemos?`,
    },

    relaciones: {
        exploracion: [
            (n) => `Las relaciones pueden ser una de las fuentes más grandes de bienestar${n}... y también de dolor cuando algo falla.\n\n¿Me puedes contar más? ¿Es con pareja, amigos, familia?`,
            (n) => `Entiendo que no es fácil${n}. ¿Fue algo que pasó recientemente, o es una situación que lleva tiempo acumulándose?`,
            (n) => `¿Cómo te sientes con respecto a esa persona o situación${n}? ¿Más enojado/a, más triste, o una mezcla de todo?`,
        ],
        validacion: [
            (n) => `Lo que describes duele${n}, y tiene sentido que te afecte. Las relaciones importan profundamente.`,
            (n) => `No tienes que minimizar lo que sientes${n}. Cuando alguien que nos importa nos falla, el dolor es real y completamente válido.`,
            (n) => `Eso que viviste${n} no estuvo bien. Tus emociones al respecto son completamente comprensibles.`,
        ],
        oferta: (n) => `Cuando tenemos conflictos con personas cercanas${n}, el cuerpo acumula tensión sin que nos demos cuenta. ¿Hacemos un ejercicio de respiración para soltar un poco antes de seguir hablando?`,
    },

    autoestima: {
        exploracion: [
            (n) => `Lo que describes${n} — sentirte insuficiente — es una de las experiencias más dolorosas. Gracias por contármelo.\n\n¿Hay algo que haya pasado recientemente que lo haya detonado, o es algo que sientes desde hace tiempo?`,
            (n) => `Eso suena muy pesado de cargar${n}. ¿Hay momentos en los que te sientes mejor contigo mismo/a, o esta sensación está presente todo el tiempo?`,
            (n) => `¿Con qué te sueles comparar${n}? ¿Es algo que viene de ti, o hay personas o situaciones específicas que lo desencadenan?`,
        ],
        validacion: [
            (n) => `La voz que nos dice que no somos suficientes miente${n}, aunque se sienta muy real. No eres lo que esa voz dice.`,
            (n) => `El hecho de que estés aquí hablando de esto${n} ya dice mucho de ti. Se necesita valentía para reconocerlo.`,
            (n) => `No estás solo/a en esto${n}. La autoestima es algo que se construye y se reconstruye — no es fija ni permanente.`,
        ],
        oferta: (n) => `Hay una visualización guiada que puede ayudarte a salir un momento de esos pensamientos tan críticos${n}. ¿Te gustaría intentarla? Solo necesitas unos minutos y un lugar tranquilo.`,
    },

    gratitud: (nombre) => [
        `Me alegra haber podido acompañarte${nombre ? ', ' + nombre : ''}. 💜 Recuerda que aquí estaré cuando lo necesites.`,
        `Fue un gusto platicar contigo${nombre ? ', ' + nombre : ''}. Cuídate mucho — pedir ayuda es una fortaleza.`,
        `¡Qué bien${nombre ? ', ' + nombre : ''}! Me alegra que te sientas mejor. Vuelve cuando quieras. 😊`,
        `Siempre es un placer acompañarte${nombre ? ', ' + nombre : ''}. Cuídate. 💜`,
    ],
};

// ─── EJERCICIOS GUIADOS ───────────────────────────────────────────────────────

const EJERCICIOS = {

    '4-7-8': [
        (n) => `Bien${n}, hagamos la respiración 4-7-8. Es sencilla y muy efectiva.\n\nBusca una posición cómoda. Cierra los ojos si puedes.\n\n¿Listo/a? Escríbeme cuando estés en posición. ✅`,
        `**Paso 1 — Exhala:**\nSuelta todo el aire por la boca, completamente. Vacía los pulmones.\n\nCuando termines, escríbeme. ✅`,
        `**Paso 2 — Inhala:**\nCierra la boca e inhala suavemente por la nariz contando hasta **4**.\n\n_Uno... dos... tres... cuatro..._\n\nEscríbeme cuando termines. ✅`,
        `**Paso 3 — Sostén:**\nMantén el aire contando hasta **7**.\n\n_Uno... dos... tres... cuatro... cinco... seis... siete..._\n\nSin prisa. ✅`,
        `**Paso 4 — Exhala:**\nSuelta el aire lentamente por la boca contando hasta **8**.\n\n_Uno... dos... tres... cuatro... cinco... seis... siete... ocho..._\n\nEscríbeme cuando termines. ✅`,
        `¡Muy bien! Eso fue un ciclo completo. ¿Quieres hacer 2 más? Con 3 ciclos los efectos son más profundos. ✅`,
        `Excelente. Completaste el ejercicio. 🌿\n\nLa respiración 4-7-8 activa tu sistema parasimpático — el "freno" natural del estrés. Con práctica regular los efectos se acumulan.\n\n¿Cómo te quedaste? ¿Notas alguna diferencia?`,
    ],

    tierra: [
        (n) => `Vamos con el ejercicio de los 5 sentidos${n}. Ancla tu mente al momento presente.\n\n¿Estás listo/a? ✅`,
        `**Paso 1 — Ve:**\nEncuentra **5 cosas** que puedas ver a tu alrededor ahora mismo.\n\nNo importa qué sean. Identifícalas una por una. ✅`,
        `Bien. **Paso 2 — Toca:**\nEncuentra **4 cosas** que puedas tocar y siente su textura — tu ropa, el piso, el aire.\n\n¿Listo/a? ✅`,
        `**Paso 3 — Escucha:**\nIdentifica **3 sonidos** ahora mismo — ruido del ambiente, silencio, tu propia respiración.\n\n¿Listo/a? ✅`,
        `**Paso 4 — Huele:**\n**2 olores** a tu alrededor. Si no percibes ninguno, recuerda el olor de algo que te guste.\n\n¿Listo/a? ✅`,
        `**Paso 5 — Saborea:**\n**1 sabor** en tu boca ahora mismo.\n\n¿Listo/a? ✅`,
        `¡Completaste el grounding! 🌱\n\nEste ejercicio le recuerda a tu cerebro que estás seguro/a en este momento. Cuando la mente se va a preocupaciones, los sentidos te traen de regreso.\n\n¿Cómo te sientes comparado con hace unos minutos?`,
    ],

    relajacion: [
        (n) => `Vamos con la relajación muscular progresiva${n}. Ideal para antes de dormir o cuando el cuerpo está muy tenso.\n\nAcuéstate si puedes. Cierra los ojos. ¿Listo/a? ✅`,
        `**Paso 1 — Pies y piernas:**\nTensa los músculos de pies y piernas con fuerza, 5 segundos...\n\nAhora suéltalos completamente. Siente cómo se relajan. 😌 ✅`,
        `**Paso 2 — Abdomen:**\nTensa el abdomen como si fuera a darte un golpe, 5 segundos...\n\nSuelta. Deja que tu respiración sea natural. 😌 ✅`,
        `**Paso 3 — Manos y brazos:**\nAprieta los puños, tensa los brazos, 5 segundos...\n\nSuelta. Siente el peso de tus brazos. 😌 ✅`,
        `**Paso 4 — Hombros y cuello:**\nSube los hombros hacia las orejas, 5 segundos...\n\nDéjalos caer completamente. Aquí suele acumularse mucha tensión. 😌 ✅`,
        `**Paso 5 — Cara:**\nArruga toda la cara — frente, ojos, mejillas, mandíbula — 5 segundos...\n\nSuelta. Deja la cara completamente floja. 😌 ✅`,
        `Completaste la relajación muscular progresiva. 🌙\n\nEsto le indica a tu sistema nervioso que es seguro descansar. Con práctica, el cuerpo aprende a asociarlo con el sueño.\n\n¿Cómo te sientes? ¿Notas la diferencia en tu cuerpo?`,
    ],

    meditacion: [
        (n) => `Vamos con una meditación guiada${n}. Solo necesitas 5 minutos.\n\nSiéntate con la espalda recta o acuéstate. Cierra los ojos suavemente.\n\n¿Listo/a? ✅`,
        `Empieza por notar tu respiración sin cambiarla. Solo obsérvala.\n\nSiente el aire entrar... llenar tu pecho... y salir.\n\nHaz esto un momento. ✅`,
        `Con cada exhalación, imagina que sueltas lo que no necesitas — tensión, preocupaciones, pensamientos.\n\nNo tienes que vaciar la mente. Cuando llegue un pensamiento, obsérvalo como una nube y déjalo pasar.\n\nHaz esto 3 veces. ✅`,
        `Lleva tu atención al cuerpo. ¿Dónde hay tensión — hombros, mandíbula, manos?\n\nCon cada exhalación, permite que esa zona se relaje un poco.\n\nNo fuerces nada. Solo observa y suelta. ✅`,
        `Toma una respiración profunda, la más profunda de todo el ejercicio.\n\nRetén un momento... y suéltala despacio.\n\nMueve suavemente los dedos y abre los ojos poco a poco cuando estés listo/a. ✅`,
        `Completaste la meditación. 🧘\n\n5 minutos de esto al día cambia la forma en que el cerebro responde al estrés con el tiempo.\n\n¿Qué notaste durante el ejercicio? ¿Cómo te sientes?`,
    ],

    visualizacion: [
        (n) => `La visualización guiada es muy poderosa${n}. Tu cerebro responde a las imágenes casi igual que a la realidad.\n\nBusca una posición cómoda y cierra los ojos. ¿Listo/a? ✅`,
        `Imagina un lugar que te genere paz y seguridad. Puede ser real o imaginario — una playa, un bosque, una habitación acogedora, donde quieras.\n\nElige ese lugar y escríbeme cuál es. ✅`,
        `Perfecto. Ahora explóralo visualmente:\n\n👀 ¿Qué ves? ¿Colores, luz, movimiento?\n\nDescríbelo mentalmente con detalle. ✅`,
        `Ahora los sonidos:\n\n👂 ¿Qué escuchas? ¿Agua, viento, silencio, música?\n\nPermítete escucharlos claramente. ✅`,
        `Siente el ambiente:\n\n🌿 ¿Qué temperatura hay? ¿Hay brisa? ¿Estás sentado/a o acostado/a?\n\nSiente el contacto de ese lugar con tu cuerpo. ✅`,
        `Quédate aquí unos momentos. Este lugar es tuyo.\n\nRespira profundo... siente la calma... y llévala contigo.\n\nCuando estés listo/a, regresa gradualmente. Mueve el cuerpo y abre los ojos. ✅`,
        `Maravilloso. 🌄\n\nEse lugar siempre estará disponible para ti — puedes volver en cualquier momento, solo cerrando los ojos y respirando.\n\n¿Cómo te quedaste? ¿Cómo se siente tu cuerpo ahora?`,
    ],
};

const MAPA_EJERCICIOS = {
    ansiedad:   '4-7-8',
    estres:     '4-7-8',
    escuela:    '4-7-8',
    relaciones: '4-7-8',
    tiempo:     'tierra',
    tristeza:   'meditacion',
    soledad:    'visualizacion',
    autoestima: 'visualizacion',
    sueno:      'relajacion',
};

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

async function getBotReply(userMessage, conversationId, moodDelDiario) {
    const msg    = userMessage.toLowerCase().trim();
    const estado = getEstado(conversationId);
    estado.mensajesCount++;
    if (moodDelDiario && !estado.moodUsuario) estado.moodUsuario = moodDelDiario;

    const nombre = estado.nombre;

    // ── CRISIS (máxima prioridad siempre) ────────────────────────────────────
    if (PALABRAS_CRISIS.some(p => msg.includes(p))) {
        set(conversationId, { fase: 'crisis' });
        return CRISIS_MSG;
    }

    // ── ALERTA ───────────────────────────────────────────────────────────────
    if (PALABRAS_ALERTA.some(p => msg.includes(p))) {
        set(conversationId, { fase: 'explorando', temaActual: 'alerta' });
        return aleatorio(ALERTA_MSGS);
    }

    // ── SEGUIMIENTO POST-EJERCICIO ───────────────────────────────────────────
    if (estado.fase === 'seguimiento_ejercicio') {
        const ejNombre = estado.ejercicioActual;
        const n = nombre ? `, ${nombre}` : '';

        // Detectar si se sintió mejor, igual o peor
        const MEJOR   = ['mejor','bien','genial','funciono','funcionó','si ayudó','ayudó','más tranquilo','más tranquila','calmé','relajé','sí','bastante'];
        const IGUAL   = ['igual','lo mismo','no cambio','no cambió','no sé','más o menos','medio','más o menos'];
        const PEOR    = ['peor','mal','no ayudó','no funciono','no funcionó','sigo igual','no sirvio','no sirvió'];

        let feedback = 'neutral';
        if (MEJOR.some(p => msg.includes(p)))  feedback = 'mejor';
        else if (PEOR.some(p => msg.includes(p)))  feedback = 'peor';
        else if (IGUAL.some(p => msg.includes(p))) feedback = 'igual';

        // Guardar feedback
        const feedbackEjercicios = { ...(estado.feedbackEjercicios || {}) };
        if (ejNombre) feedbackEjercicios[ejNombre] = feedback;
        set(conversationId, { fase: 'explorando', feedbackEjercicios, ejercicioActual: null });

        if (feedback === 'mejor') {
            return aleatorio([
                `Me alegra mucho escuchar eso${n}. 💜 Esa diferencia que sientes, aunque sea pequeña, es real.

¿Hay algo más en lo que te pueda acompañar hoy?`,
                `¡Qué bueno${n}! El cuerpo y la mente responden cuando les damos espacio.

Si en algún momento lo necesitas, ya sabes que puedes volver a este ejercicio. ¿Hay algo más de lo que quieras hablar?`,
                `Me da mucho gusto${n}. Recuerda que puedes hacer este ejercicio en cualquier momento que lo necesites, no solo aquí.

¿Cómo estás emocionalmente ahora?`,
            ]);
        }
        if (feedback === 'peor') {
            return `Entiendo${n}. A veces hay cosas que pesan tanto que un ejercicio no es suficiente, y eso está bien.

Lo más importante es que estás hablando de ello. ¿Quieres contarme más sobre cómo te sientes? Estoy aquí.`;
        }
        // igual o neutral
        return aleatorio([
            `Está bien${n}. No todos los ejercicios funcionan igual para todas las personas o en todos los momentos. Lo importante es que lo intentaste.

¿Quieres que probemos algo diferente, o prefieres seguir platicando?`,
            `Entiendo${n}. A veces el alivio es gradual y no siempre se siente de inmediato. ¿Cómo estás emocionalmente en este momento?`,
        ]);
    }

    // ── EJERCICIO EN CURSO ───────────────────────────────────────────────────
    if (estado.fase === 'ejercicio') return continuarEjercicio(conversationId, estado);

    // ── CONFIRMACIÓN DE EJERCICIO ─────────────────────────────────────────────
    const AFIRMA = ['sí','si','dale','va','claro','ok','okay','bueno','vamos','adelante','hagamos','quiero','por favor','listo','ya','hecho','continuar','siguiente','next','done'];
    const NIEGA  = ['no','no gracias','ahora no','después','luego','mejor no'];

    if (estado.fase === 'ofreciendo_ejercicio') {
        if (AFIRMA.some(p => msg.includes(p))) {
            const ej = MAPA_EJERCICIOS[estado.temaActual] || 'tierra';
            set(conversationId, { fase: 'ejercicio', ejercicioActual: ej, pasoEjercicio: 0 });
            const primer_paso = EJERCICIOS[ej][0];
            return typeof primer_paso === 'function' ? primer_paso(nombre ? `, ${nombre}` : '') : primer_paso;
        }
        if (NIEGA.some(p => msg === p || msg.startsWith(p))) {
            set(conversationId, { fase: 'explorando' });
            return nombre
                ? `Sin presión, ${nombre}. 😊 ¿Hay algo más en lo que te pueda acompañar?`
                : `Sin presión. 😊 ¿Hay algo más en lo que te pueda acompañar?`;
        }
    }

    // ── CAPTURA DE NOMBRE (segunda respuesta del usuario) ────────────────────
    if (estado.fase === 'preguntando_nombre') {
        const nombreCapturado = extraerNombre(msg);
        set(conversationId, { nombre: nombreCapturado, fase: 'explorando', preguntadoNombre: true });
        const responses = R.nombre_recibido(nombreCapturado);
        return aleatorio(responses);
    }

    // ── INTENCIÓN ─────────────────────────────────────────────────────────────
    const intencion = detectarIntencion(msg);

    // ── ESTADO INICIAL — siempre pedir nombre primero ────────────────────────
    if (estado.fase === 'inicial') {
        set(conversationId, { fase: 'preguntando_nombre', preguntadoNombre: true });
        return aleatorio(R.saludo.sinNombre);
    }

    // ── SALUDO EXPLÍCITO (después de tener nombre) ────────────────────────────
    if (intencion === 'saludo') {
        if (!estado.nombre) {
            set(conversationId, { fase: 'preguntando_nombre', preguntadoNombre: true });
            return aleatorio(R.saludo.sinNombre);
        }
        // Solo mostrar greeting con mood si el mensaje ES un saludo claro
        // no mostrar si el usuario ya está en una conversación emocional
        if (estado.fase === 'explorando' && estado.temaActual) {
            const n = nombre ? `, ${nombre}` : '';
            return `Estoy aquí${n}. ¿Cómo te sientes ahorita?`;
        }
        set(conversationId, { fase: 'explorando' });
        return R.saludo.conNombre(nombre, estado.moodUsuario);
    }

    // ── GRATITUD / DESPEDIDA ──────────────────────────────────────────────────
    if (intencion === 'gratitud') return aleatorio(R.gratitud(nombre));

    // ── EJERCICIOS DIRECTOS ───────────────────────────────────────────────────
    if (intencion === 'respiracion') {
        set(conversationId, { fase: 'ejercicio', ejercicioActual: '4-7-8', pasoEjercicio: 0 });
        const p = EJERCICIOS['4-7-8'][0];
        return typeof p === 'function' ? p(nombre ? `, ${nombre}` : '') : p;
    }
    if (intencion === 'meditacion') {
        set(conversationId, { fase: 'ejercicio', ejercicioActual: 'meditacion', pasoEjercicio: 0 });
        const p = EJERCICIOS.meditacion[0];
        return typeof p === 'function' ? p(nombre ? `, ${nombre}` : '') : p;
    }
    if (intencion === 'visualizacion') {
        set(conversationId, { fase: 'ejercicio', ejercicioActual: 'visualizacion', pasoEjercicio: 0 });
        const p = EJERCICIOS.visualizacion[0];
        return typeof p === 'function' ? p(nombre ? `, ${nombre}` : '') : p;
    }

    // ── GUARDAR CONTEXTO (frases clave del usuario) ──────────────────────────
    if (msg.length > 15 && estado.fase === 'explorando') {
        const contexto = [...(estado.contexto || [])];
        if (contexto.length < 5) {
            const resumen = userMessage.substring(0, 80);
            if (!contexto.includes(resumen)) contexto.push(resumen);
            set(conversationId, { contexto });
        }
    }

    // ── TEMAS CON EXPLORACIÓN PROGRESIVA ─────────────────────────────────────
    const TEMAS = ['estres','ansiedad','tristeza','soledad','escuela','tiempo','sueno','relaciones','autoestima'];
    if (TEMAS.includes(intencion)) {
        const tema = R[intencion];
        const nn   = nombre ? `, ${nombre}` : '';

        if (estado.fase === 'explorando' && estado.temaActual === intencion) {
            set(conversationId, { fase: 'ofreciendo_ejercicio' });
            const val = aleatorio(tema.validacion);
            return (typeof val === 'function' ? val(nn) : val) + '\n\n' +
                   (typeof tema.oferta === 'function' ? tema.oferta(nn) : tema.oferta);
        }
        // Comprobar si ya habló de este tema ANTES de actualizar la lista
        const yaHabloDeEsto = (estado.temasDiscutidos || []).includes(intencion);

        const temasDiscutidos = [...(estado.temasDiscutidos || [])];
        if (!temasDiscutidos.includes(intencion)) temasDiscutidos.push(intencion);
        set(conversationId, { fase: 'explorando', temaActual: intencion, temasDiscutidos });

        if (yaHabloDeEsto) {
            // Ya habló de esto — ofrecer ejercicio directamente con reconocimiento
            set(conversationId, { fase: 'ofreciendo_ejercicio' });
            const referencias = {
                estres:    `Noto que el estrés sigue presente${nn}. \n\n`,
                ansiedad:  `Parece que la ansiedad sigue dando vueltas${nn}. \n\n`,
                tristeza:  `Veo que la tristeza persiste${nn}. \n\n`,
                soledad:   `Parece que la soledad sigue siendo un tema importante${nn}. \n\n`,
                escuela:   `La escuela sigue pesando${nn}. \n\n`,
                tiempo:    `Seguimos con el tema del tiempo${nn}. \n\n`,
                sueno:     `El sueño sigue siendo un problema${nn}. \n\n`,
                relaciones:`Parece que las relaciones siguen en tu mente${nn}. \n\n`,
                autoestima:`Noto que esos pensamientos persisten${nn}. \n\n`,
            };
            const prefijo = referencias[intencion] || '';
            const oferta  = typeof tema.oferta === 'function' ? tema.oferta(nn) : tema.oferta;
            return prefijo + oferta;
        }

        const exp = aleatorio(tema.exploracion);
        return typeof exp === 'function' ? exp(nn) : exp;
    }

    // ── CONTINUACIÓN DEL TEMA ACTUAL (usuario responde sin keywords nuevas) ──
    if (estado.fase === 'explorando' && estado.temaActual && TEMAS.includes(estado.temaActual)) {
        const tema = R[estado.temaActual];
        const nn   = nombre ? `, ${nombre}` : '';

        // Si ya hizo un ejercicio de este tema, ofrecer uno diferente
        const ejHecho   = estado.feedbackEjercicios?.[MAPA_EJERCICIOS[estado.temaActual]];
        const ejercAlternativo = Object.keys(EJERCICIOS).find(e =>
            e !== MAPA_EJERCICIOS[estado.temaActual] && !(estado.ejerciciosHechos || []).includes(e)
        );

        set(conversationId, { fase: 'ofreciendo_ejercicio' });
        const val = aleatorio(tema.validacion);
        let oferta = typeof tema.oferta === 'function' ? tema.oferta(nn) : tema.oferta;

        // Si ya hizo ese ejercicio antes y no le ayudó mucho, sugerir alternativa
        if (ejHecho && ejHecho !== 'mejor' && ejercAlternativo) {
            oferta = `La última vez hiciste un ejercicio que no fue del todo suficiente${nn}. ¿Quieres intentar algo diferente esta vez? Tengo otras técnicas que pueden funcionar mejor para este momento.`;
        }

        return (typeof val === 'function' ? val(nn) : val) + '\n\n' + oferta;
    }

    // ── MOOD DEL DIARIO — solo al inicio y sin tema activo ──────────────────────
    if (estado.moodUsuario && !estado.temaActual && estado.mensajesCount <= 3) {
        return respuestaSegunMood(estado.moodUsuario, nombre);
    }

    // ── GENÉRICA ──────────────────────────────────────────────────────────────
    return respuestaGenerica(nombre, estado.mensajesCount);
}

// ─── CONTINUAR EJERCICIO ──────────────────────────────────────────────────────

function continuarEjercicio(conversationId, estado) {
    const ej       = estado.ejercicioActual;
    const pasos    = EJERCICIOS[ej];
    const siguiente = estado.pasoEjercicio + 1;

    if (siguiente < pasos.length) {
        set(conversationId, { pasoEjercicio: siguiente });
        const paso = pasos[siguiente];
        return typeof paso === 'function' ? paso('') : paso;
    }

    // ── Ejercicio completado — registrar y pedir seguimiento ─────────────────
    const ejerciciosHechos = [...(estado.ejerciciosHechos || [])];
    if (!ejerciciosHechos.includes(ej)) ejerciciosHechos.push(ej);

    set(conversationId, {
        fase:            'seguimiento_ejercicio',
        pasoEjercicio:   0,
        ejercicioActual: ej,          // guardamos para registrar el feedback
        ejerciciosHechos,
    });

    const nombre = estado.nombre;
    const n = nombre ? `, ${nombre}` : '';
    const preguntas = [
        `¿Cómo te sientes ahora comparado con antes de empezar${n}? ¿Notas alguna diferencia?`,
        `¿Cómo quedaste${n}? ¿Sientes que te ayudó, o la tensión sigue igual?`,
        `Cuéntame${n}, ¿cómo está tu cuerpo y tu mente después del ejercicio?`,
    ];
    return aleatorio(preguntas);
}

// ─── DETECCIÓN DE INTENCIÓN ───────────────────────────────────────────────────

function detectarIntencion(msg) {
    for (const [intencion, palabras] of Object.entries(INTENCIONES)) {
        if (Array.isArray(palabras) && palabras.some(p => msg.includes(p))) return intencion;
    }
    return null;
}

// ─── EXTRAER NOMBRE DEL MENSAJE ───────────────────────────────────────────────

function extraerNombre(msg) {
    // Quitar frases comunes y quedarse con el nombre
    const limpio = msg
        .replace(/me llamo\s*/i, '')
        .replace(/soy\s*/i, '')
        .replace(/mi nombre es\s*/i, '')
        .replace(/puedes llamarme\s*/i, '')
        .replace(/llámame\s*/i, '')
        .trim();
    // Capitalizar primera letra
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

// ─── RESPUESTA SEGÚN MOOD ────────────────────────────────────────────────────

function respuestaSegunMood(mood, nombre) {
    const n = nombre ? `, ${nombre}` : '';
    const r = {
        ansioso:     `Noto que has estado ansioso/a${n}. ¿Quieres contarme qué ha estado generando esa ansiedad?`,
        agobiado:    `Parece que has tenido días muy cargados${n}. ¿Qué es lo que más te está pesando?`,
        frustrado:   `La frustración puede ser muy desgastante${n}. ¿Qué la está generando?`,
        triste:      `Parece que has tenido días difíciles${n}. ¿Quieres contarme qué ha estado pasando?`,
        solitario:   `La soledad puede doler mucho${n}. ¿Cómo te has sentido?`,
        desesperado: `Me preocupa cómo te has sentido${n}. ¿Puedes contarme más?`,
        neutral:     `¿Cómo estás hoy${n}? ¿Hay algo en lo que te pueda acompañar?`,
        tranquilo:   `Qué bueno que estés tranquilo/a${n}. ¿Hay algo en lo que te pueda ayudar?`,
        contento:    `Me alegra que estés bien${n}. 😊 ¿En qué te puedo acompañar?`,
        euforico:    `¡Qué energía${n}! 🌟 ¿Qué te tiene tan animado/a?`,
    };
    return r[mood] || respuestaGenerica(nombre, 0);
}

// ─── RESPUESTA GENÉRICA ───────────────────────────────────────────────────────

function respuestaGenerica(nombre, count) {
    const n = nombre ? `, ${nombre}` : '';
    const opts = [
        `Cuéntame más${n}. ¿Cómo te has sentido hoy?`,
        `Estoy aquí para escucharte${n}. ¿Hay algo que te esté pesando?`,
        `¿Cómo puedo acompañarte hoy${n}?`,
        `¿Qué ha pasado${n}? Estoy aquí, sin prisa.`,
        `Este es tu espacio${n}. Puedes contarme lo que quieras.`,
        `¿Qué te trajo por aquí hoy${n}?`,
    ];
    return opts[count % opts.length];
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

function aleatorio(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { getBotReply };
