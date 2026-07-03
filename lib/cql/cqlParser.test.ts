import {CqlParser} from "@/lib/cql/cqlParser";

try {
    const query = '[pos="ADJ" & feats_gender="masc"] [lemma="dom"]';
    const ast = CqlParser.parse(query);

    console.log(JSON.stringify(ast, null, 2));
} catch (error) {
    if (error instanceof Error) {
        console.error(error.message);
    }
}
