import { Tokenizer } from './tokenizer';

const sampleText = `«Vy jeste krasive, ale jeste prazdne», prodolžil on. «Ne možno jest umreti dlja vas. Očevidno, obyčny prohodnik by pomyslil, že moja roza jest podobna vam. Ale ona jedna jest dlja mene važnějša od vas vsih. Tomu že ja ju podlival jesm. Tomu že ja ju nakryval jesm steklěnym kolpakom. Tomu že ja ju zaslanjal jesm paravanom. Tomu že ja dlja njej poubival jesm gusenice (kromě dvoh, da by byli motyli). Tomu že ja ju slušal jesm, kogda ona žalila se, ili kogda ona hvalila se, ili daže kogda ona molčala. Tomu že ona jest moja roza.» `;

async function runTest() {
    const sentences = Tokenizer.splitSentences(sampleText);

    console.log(`\n=== РАЗБИВКА НА ПРЕДЛОЖЕНИЯ (${sentences.length}) ===`);
    sentences.forEach((s, i) => {
        console.log(`\n[${i + 1}] ${s}`);
    });

    console.log(`\n=== ТОКЕНИЗАЦИЯ ПОТОКОВАЯ ===`);

    let totalTokens = 0;
    let totalWords = 0;
    let totalPunct = 0;

    for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const tokens = await Tokenizer.tokenizeSentence(sentences[sIdx]);

        console.log(`\n--- Предложение ${sIdx + 1} (${tokens.length} токенов) ---`);

        for (const t of tokens) {
            const type = t.isPunctuation ? 'PUNCT' : 'WORD';
            const slug = t.analysis.wordSlug || '—';
            const pos = t.analysis.pos;
            const feats = Object.keys(t.analysis.feats).length
                ? JSON.stringify(t.analysis.feats)
                : '—';

            console.log(
                `  ${type.padEnd(5)} | "${t.surfaceForm.padEnd(25)}" | lemma: ${t.analysis.lemma.padEnd(12)} | pos: ${pos.padEnd(6)} | slug: ${slug.padEnd(18)} | feats: ${feats}`
            );

            totalTokens++;
            if (t.isPunctuation) totalPunct++;
            else totalWords++;
        }
    }

    console.log(`\n=== ИТОГО ===`);
    console.log(`Предложений: ${sentences.length}`);
    console.log(`Токенов всего: ${totalTokens}`);
    console.log(`Слов: ${totalWords}`);
    console.log(`Пунктуации: ${totalPunct}`);

    const tokenizeResult = await Tokenizer.tokenizeDocument('test-doc', sampleText, () => 'test-uuid');
    console.log(`\n=== ПРОВЕРКА tokenizeDocument ===`);
    console.log(`Предложений: ${tokenizeResult.sentences.length}`);
    console.log(`Токенов: ${tokenizeResult.tokenInputs.length}`);

    const wordTokens = tokenizeResult.tokenInputs.filter(t => t.wordIndex >= 0);
    const punctTokens = tokenizeResult.tokenInputs.filter(t => t.wordIndex === -1);
    console.log(`Слов: ${wordTokens.length}, Пунктуации: ${punctTokens.length}`);

    if (tokenizeResult.tokenInputs.every(t => t.sentenceId === 'test-uuid')) {
        console.log('WARNING: все sentenceId одинаковы — возможна проблема с генерацией ID');
    } else {
        console.log('OK: sentenceId различаются между предложениями');
    }

    const slugCount = wordTokens.filter(t => t.wordSlug !== null).length;
    console.log(`Токенов со slug: ${slugCount} / ${wordTokens.length}`);
}

runTest().catch(console.error);