import { generateAdjectiveForm, EnhancedAdjDbItem, AdjFormRequest } from './adjectiveEngine';
import { Case, NumberType } from './nounEngine';
import { GrammaticalGender, AccentParadigm, ProtoStemClass } from '@/types/morphology';

export interface OrdinalDbItem {
    interslavic: string;       // "pěrvy" (твердый тип) или "tretji" (мягкий тип)
    protoSlavic: string;
    paradigm: AccentParadigm; // Обычно Парадигма А (стабильное ударение)
    protoStemClass: ProtoStemClass; // o_short или jo_short
}

/**
 * Порядковые числительные склоняются СТРОГО как полные прилагательные
 */
export function declineOrdinalNumeral(request: {
    dbItem: OrdinalDbItem;
    targetCase: Case;
    targetNumber: NumberType;
    targetGender: GrammaticalGender;
}): string {
    // Адаптируем интерфейс порядкового числительного под контракт полного прилагательного
    const adjItem: EnhancedAdjDbItem = {
        interslavic: request.dbItem.interslavic,
        protoSlavic: request.dbItem.protoSlavic,
        paradigm: request.dbItem.paradigm,
        protoStemClass: request.dbItem.protoStemClass
    };

    return generateAdjectiveForm({
        dbItem: adjItem,
        targetCase: request.targetCase,
        targetNumber: request.targetNumber,
        targetGender: request.targetGender
    });
}
