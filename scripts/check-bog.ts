import { prismaData } from '../lib/prisma';

async function main() {
    const word = await prismaData.word.findFirst({
        where: { value: 'bog' }
    });
    console.log(JSON.stringify(word, null, 2));
}

main().catch(console.error);
