export enum ProtoStemClass {
    A_LONG    = 'A_LONG',    // Основы на *-ā (древние твердые женского/мужского рода: *voda, *sluga)
    JA_LONG   = 'JA_LONG',   // Основы на *-jā (древние мягкие женского/мужского рода: *zemlja, *duša)
    O_SHORT   = 'O_SHORT',   // Основы на *-o (твердые мужского/среднего рода: *domъ, *selo)
    JO_SHORT  = 'JO_SHORT',  // Основы на *-jo (мягкие мужского/среднего рода: *kon’ь, *pole)
    I_SHORT   = 'I_SHORT',   // Основы на *-i (женский и мужской род: *kostь, *gostь)
    U_LONG    = 'U_LONG',    // Основы на *-ū (древний долгий u, женский род: *creky, *ljuby)
    U_SHORT   = 'U_SHORT',   // Основы на *-u (краткий u, мужской род, перешедший в o-основы: *synъ, *medъ)
    CONSONANT = 'CONSONANT'  // Консонантные основы (на согласный: *-en, *-es, *-ent, *-er)
}

export enum StemExtension {
    EN  = 'EN',  // Наращение на *-en (мужской/средний род: *imę -> imene)
    ES  = 'ES',  // Наращение на *-es (средний род: *slovo -> slovesa)
    ENT = 'ENT', // Наращение на *-ent / *-ęt (детеныши: *telę -> telęte / telenti)
    ER  = 'ER',  // Наращение на *-er (термины родства: *mati -> matere)
    NONE = 'NONE'
}
