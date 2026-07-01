import {analyzeText} from "@/lib/analyze-text";

const text = `
«Lěpje by bylo, ako bys prihodil v to samo vrěme», rěkla lisica. «Ako budeš prihoditi, na priklad, v četvrtu časinu popoldnja, togda od tretjej časiny načinaju odčuvati ščestje. Koliko veče vrěmena mine, toliko bolje budu ščestlivějši. V četvrtu časinu uže budu cěly vozbudženy i zanepokojeny. I tako budu odkryti cěnu ščestja! Ale ako ty budeš prihoditi kogda popade, ja nikogda ne budu znal, na ktoru časinu imaju gotoviti srdce... Potrěbne sut obredy.»
`;

const test = async () => {
    const res = await analyzeText(text);

    console.log(res.unknownCandidates);
};

(async () => {
    test();
})()