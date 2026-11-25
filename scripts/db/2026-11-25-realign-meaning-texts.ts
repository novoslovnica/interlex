import { createHash, randomUUID } from "node:crypto"
import Database from "better-sqlite3"

type TextFields = {
    meaning: string | null
    examples: string | null
}

type MeaningRow = TextFields & {
    lexemeId: number
    slug: string
    meaningVerified: number | null
    examplesVerified: number | null
    meaningMessage: string | null
    examplesMessage: string | null
}

type Repair = [id: number, slug: string, before: string, meaning: string | null, examples: string | null]

// The July CSV survives in f429319^:data/meanings_definitions.csv.
// In 412–711, only the exact imported lines were removed from the reviewed
// snapshot. 415 is correctly attached. Transfers and swaps are grouped so a
// concurrent editorial change on either side leaves the entire group intact.
// Transfers: 440→423 (da), 491→465 (dejstvo), 515→477 (denar), 567→501 (devica).
// Other replacements in this range come from existing senses of the same
// word with matching Russian and English glosses.
// A null replacement leaves the translation as the evidence for editorial review.
const groups: Repair[][] = [
    [[412, "cetvrec-NOUN", "929780de6d08a4b71455f043cd902e1807f5f2d97f91823c211cd9e5c117d635", null, null]],
    [[413, "cetvrecica-NOUN", "198e0a6a1337a6628fb9a1c828136dd916ea29d35f407d097281d1f1017b6455", null, null]],
    [[414, "cetvrecny-ADJ", "fb3fa31723a28f2ae4000d9e961e83459a709b6e1e413aeeab5b3e9fa213428d", null, null]],
    [[416, "cuzbina-NOUN", "40200169b2507589604e8ccf25cd73db2e1ed96166ac8015524333eff5dc3520", null, null]],
    [[417, "cuzina-NOUN", "4fdb290f56c8140b8a17542aa8a43fb8deb8bfbcf9c922bc206bf5f30eb2785b", null, null]],
    [[420, "cvrcati-VERB", "ee6fd52a8cec1fd5dca9b85a6b503a0f89af1e818e095d537e3f8a47980686f0", null, null]],
    [[421, "cvrkati-v", "74ff6d664794300f333e3198b9699c8d7497f4716e54efc3ad197122db9928df", null, null]],
    [[422, "cvrkutati-v", "2fc7c6d3512284f98785c9f194689ac870c04c1d7bc376112fb7d148c834d9aa", null, null]],
    [[423, "da-int", "aaf4a054187c1fbc90d67016919d909a5b3d6b987a3fd759b85cf84b935beba4", "Utvrda, pritvrda;!**Da**, eto pravda. — **Da**, ja idu s toboju.", "!**Da**, eto pravda. — **Da**, ja idu s toboju."], [440, "datcy-n", "d0ea845c449d81105b9ba97307f05a911b98d5a79a22211fae771a146857c587", null, null]],
    [[424, "dabi-conj", "c07f506db769065cee6d1c516afcf50d7104a9072de7df8500d030163c72593f", null, null]],
    [[425, "djadja-n", "23fa6221efd72a8a121b5d6c647e31c088c2c3d920649c71cd9a0f32a48223f6", null, null]],
    [[426, "dalina-n", "2853d5873ae157b97dd4a453bda2d5a099b081611201babd0b926969de8bbf5b", null, null]],
    [[427, "daljko-adv", "0ae3cc8a7c6dde589967ab3b2f28bec47e6b3d681dde461f4e146923a0136406", null, null]],
    [[428, "daljky-adj", "9cb499265badf1bc23bd143ef6267fed2a9a754a3f0b17d88d298c5dbcc4103d", null, null]],
    [[429, "daljnica-n", "093350f1e400b592c8eb2d50a4cc700cfc01e5d41058f75e5ff204759750dd7c", null, null]],
    [[430, "daljsej-ADV", "9b8bd9fb5b4688b37969da7964a7a6c11a31d47f14c3b053d744484639885612", null, null]],
    [[431, "daljsej-ADV", "fc4fe3efe7cc3aa0594681f55090dd8348f9125d08604e56a6f9068aeb3e9cff", null, null]],
    [[432, "dzamahiriia-NOUN", "123c660c9253c4d7ee79bfeb0cf7e91f578ef0ab026f8b8dc045ebe5b1a1b62e", null, null]],
    [[433, "dzamiia-NOUN", "a1e61d01309daa5d1e069648906b80179e7effcd490678be5cd461ce736867a4", null, null]],
    [[437, "darovac-NOUN", "edb35f43df59e4685d22fa7e3d6dcb582d46b3eb15732ee92187bf2caef84edb", null, null]],
    [[438, "darovane-g", "ff206fb33fbdc5bfc78fc5c1b069fdaac8b79bbb4bf1a7b0ac26dfd8c795ab71", null, null]],
    [[441, "datek-n", "c84107f8ae2db9cfcc4a459119df7fe2f0c73c0188122ab234b33628be42da0b", null, null]],
    [[444, "davnina-n", "a30012eeb40f873456503f789373e3a0d2284d4ec27d7120f65d3a36d7b9b8f9", null, null]],
    [[446, "davnostj-n", "1b9afd68075028a31d16dd31825165d0def84bd23c761b650c76c7b201bf25f2", null, null]],
    [[447, "davnostj-n", "80d29ad08bee359bd886adbfba12bfd0e3696e455ab45be2a88c760f4a6aa5f9", null, null]],
    [[452, "dcera-NOUN", "c82eda6f43dff0dc99b7b22d429b343d8d6e9787d5ae08981617db37a5dd0fb3", null, null]],
    [[453, "de-adv", "8d3b78ac6966e54fc73491fa1e9b9d10cb96e421c2737a3a8a304b9c0e449b8a", null, null]],
    [[455, "dedic-NOUN", "c0d7d61accc013c8a3de8880da24f0681e8a698e9399c13e3186800542d497cf", null, null]],
    [[456, "dedicnostj-NOUN", "9fcf878c3e4fa03865b2949cf32ce9c414f9c9cb042bcd3e0e5059838eb2ba74", null, null]],
    [[457, "dedicny-ADJ", "65e014650c5d3ec9f6f36c5e1ff1b238a1f4c3a73ef2afcdbafc91c4e7d520f8", null, null]],
    [[458, "dedicovati-VERB", "f837bf3c3a5fef3a6caf806fa3b8cb602f9fd257528de2ecd3370234798be094", null, null]],
    [[459, "dedicstvo-NOUN", "93ef14405eb243dd99569f5a0eefb2b1e093e30452bddb2068ae24b835d15418", null, null]],
    [[460, "dedicstvo-NOUN", "0a5db1bc9bcd99a7ae124a9b4e612483975ca1bfc208309d7d1fd6b1d0ab3d4a", null, null]],
    [[461, "dedka-NOUN", "283a6c58fdf516b25b2d0f084d7f492a9d368512cfafd3da6f734444359a9b11", null, null]],
    [[462, "dedzlo-NOUN", "ad425eb990234d6c635d2e35b55926b4cc438d0755d124a83450ba22b066b137", null, null]],
    [[463, "deduska-NOUN", "180c195c67be3345b6ba7f05fa0fda4688632413ece7476822b7f19288bdb394", null, null]],
    [[464, "dejstviie-NOUN", "06005bb277e95b793dd782ffab84abae4d65da13b35c36e45830f2fa30a27c0c", null, null]],
    [[465, "dejstvo-NOUN", "5180ae94d0e7e13360d6764d4eaf0fbcad408902bb2a891eca495234b24d0c05", "Dějstvo, akcija;!**Dejstvo** proishodilo na sceně. — **Dejstvo** bylo dramatično.", "!**Dejstvo** proishodilo na sceně. — **Dejstvo** bylo dramatično."], [491, "detina-NOUN", "d9d05806e5a8d911290059f15764ee20e360cb3bf8ea21a526e5ade2a05e7aaf", null, null]],
    [[466, "deiec-NOUN", "90dfb97efa224f674f22c45851c466d15d1ad5721224cf06ea936c37e044d1f2", null, null]],
    [[467, "dekuiem-X", "0e5abc9494d95786e25a6802a48d8eebe40b1782e7c1dfda71cc33bf4e323eb8", null, null]],
    [[468, "dekuiemo-X", "a505ea9f64cf44a4ca4b8c721f3180169a3e79a50b6de9365f95dff6b50c0445", null, null]],
    [[469, "delati-VERB-3", "b3a4dda787ccda2b6ff189fc0c0e7f663836de9aa532c5a615788699b9c24b61", "dělati;tože, čto i činiti; stvoriť rabotų, predmety abo dvygati proekt, delatь;*Ona ne lųbila **dělati** s sčitańje finansov bez računalьnoj aplikacije.*", "!**Dělajuča** programa jest byla razporedžala sama resursami kompjutera.\n*Ona ne lųbila **dělati** s sčitańje finansov bez računalьnoj aplikacije.*"]],
    [[470, "delene-X", "f0e9d4f3a30b6eb3f198c9e8294bfeb0da090825d457d72f74aea8f7f7ad339e", "Действие", null]],
    [[471, "deleniie-NOUN", "9f643f5b69f7861dc0e622bedb78ea1dc0eaf69b8a8bb717eba72e3562f4e3a3", "Единица", null]],
    [[472, "deliti-VERB-3", "1de31ef1bd9de2d3ba1ba3d32db96bf5342d7e55c7ffa02ca2b70b89e74e597c", "děliti;rastańjati cělo na male čęstki v prostranstvě abo v sčitańjų matematiky;*Inženěr počel **děliti** čeličnu cěvkų na četyri odnaky děl_ы.*", "!\n*Inženěr počel **děliti** čeličnu cěvkų na četyri odnaky děl_ы.*"]],
    [[477, "denar-NOUN", "437d90afb5c546bb073732d194c932541c61f888dc6b6441f5904d20aa30dc7b", "Denežna jedinica;!**Denar** starodavnoj Makedoniji. — **Denar** jest valuta Makedoniji.", "!**Denar** starodavnoj Makedoniji. — **Denar** jest valuta Makedoniji."], [515, "dlanky-NOUN", "2d0dde9fb46dff980123590fc83d5c21f5399d14d03093061e779f11ce1c0373", null, null]],
    [[478, "denj-n", "1d9a09c81d370fe72e19951a8f97d5493936921e43013f0d2cfc702179b73639", "dėnj;period vrěmene od utра do večera, svetlorodny děl_enы dňa, dvoždana dųgość, denь;*Tuten apriljsky **dėnj** byl polno bezsněžny i solnce světiło teplorodno.*", "!\n*Tuten apriljsky **dėnj** byl polno bezsněžny i solnce světiło teplorodno.*"]],
    [[479, "dennica-n", "c956e59a996fef068367f0a711cd9983a1fd6b002e799b5f3d539b7c6a22db7a", null, null]],
    [[480, "dennik-n", "b1ecbafb18d8903d3c52aab15e41c00b5087568f9c8065cb15fab2192997c2e9", null, null]],
    [[481, "dennik-n", "3c8dbe0f5643de6f3a6099d89b470ba505d23b0d58fb22bb88b1fde6564f91f0", null, null]],
    [[482, "denny-adj", "2e9a692ef9524a1f618f4131aad08e5e5651caa994e07144713cea1bc8855227", null, null]],
    [[483, "denonocie-NOUN", "d94498a248b3f652f0f291be2e6e13c56797bf62a33087fb029ebb1a7fca3c9b", null, null]],
    [[484, "deset-NUM", "6e1b745208387ec7f5370f3973468047a28ab484b51b6f316ac83500f5d3cfdd", "desęť;bazu čislo desęt (10), sčitańje, ktore leži medžu devat i jedina-desęť;*On vzął iz kofěра **desęť** banknotov, da by platil vkusny bifštek.*", "!Bog ponovno napisal **deset** zapovědij na novyh tabelah.\n*On vzął iz kofěра **desęť** banknotov, da by platil vkusny bifštek.*"]],
    [[485, "desetero-NUM-2", "a5abc7e4ca1a40cdd19a4f09fcfa513b9f4bedcec001e07d9282519fd8b683c8", null, null]],
    [[486, "desetikratno-ADV", "718df9baa8ea718a7cec79fac842740b07955d6c6b4035ed972a5c7fd14e80d3", null, null]],
    [[487, "desnak-NOUN", "bd74a75db000fb30ab62ed2345d0f0524519cc0c4a4525ab17444e3bc068f563", null, null]],
    [[488, "desnica-NOUN-2", "fb88457d9c3b9a664571e1875305f4b73c19e50b8abbb6ca0a0b5c822ff176af", "desnica;prava rųka člověka, simvol moči, spravědlivosti i zakonnogo upraveńja;*Kozacky ataman vzała svoj močny nož v **desnicų** prěd centralьnym bojem.*", "!\n*Kozacky ataman vzała svoj močny nož v **desnicų** prěd centralьnym bojem.*"]],
    [[489, "desny-ADJ-2", "6be0043a6bbc90bcb4ad3049b2302db3190afdee80a1b464c04acb0fe28ceb48", "desny;ktory leži на pravej stroně, lateralьny děl prostranstva, ne-lěvy, pravyj;*On prědał bočny poględ на **desny** děl stěne centralьnogo banka.*", "!\n*On prědał bočny poględ на **desny** děl stěne centralьnogo banka.*"]],
    [[490, "dete-NOUN-3", "7f66b8f011cfa6e105a7d5a19b01b8802581b4032199d13bda6a5344158d7c83", "dětę;maly dětinec, novoroždena dětka, syn abo děvka v prěvom rědu jizni, ditja;*Mlada matь dĕržala svoje lųbimoje **dětę** na rųkah prěz cělu nočь.*", "!**Děte** jest člověk v času dětstva.\n*Mlada matь dĕržala svoje lųbimoje **dětę** na rųkah prěz cělu nočь.*"]],
    [[495, "devet-NUM-2", "eefc32569f90c7ddbd59789c5b947aa4971a3d12d8690765820ba62a73800efe", "devęť;bazu čislo devat (9), sčitańje, ktore leži medžu osьm i desęť;*On kupił **devęť** cělyh kilogramov svěžego batata на centralьnom rynkų.*", "!V Urugvaju sut **devet** narodnyh parkov.\n*On kupił **devęť** cělyh kilogramov svěžego batata на centralьnom rynkų.*"]],
    [[496, "devetdeset-NUM-2", "1538de4306aebf38e31ea7ef7f8d9464956b5b0c03f9cdf668ad47aa4752554d", "devęťdesęt;čislo devatdesęt (90), sčitańje devati rědov po desęt elementov;*Stary děd proživel **devęťdesęt** lět v miru i duhovnom blågostańjų.*", "!Bylo ubito pet tysečev ljudij i spaljeno na **devetdeset** sel.\n*Stary děd proživel **devęťdesęt** lět v miru i duhovnom blågostańjų.*"]],
    [[497, "devetikratno-ADV", "b452841a0a2a76a838c9243a23e9b5c9f512e0caa7ac09a75166bbc9c1795a6e", null, null]],
    [[498, "devetnadeset-NUM", "e97617c87acb47d6c5d64b13ebfaabeada4aae371527224669547a1c91e70cbc", null, null]],
    [[499, "devetst-NUM", "c1b1efc00af99b4df361df6d6bd6314fe099d4451d7c9554d9f8d28b97e2347e", null, null]],
    [[500, "devety-ADJ", "18cee8010b6d246c8f83e4c87680105de061a78dd8f65cd273b0e76b2540fe1b", "devęty;ordinarny urędny sčot, ktory slųduje poslě osmogo v rědu;*Oni budovali **devęty** budynȯk novoj katedralьnoj biblioteky grada.*", "!\n*Oni budovali **devęty** budynȯk novoj katedralьnoj biblioteky grada.*"]],
    [[501, "devica-NOUN", "1ed6b5f89d38e4184dc2cc95a9f250e6d341de41cc8d8bd72b5bdc5a74afb1b8", "Děvica, mlada neženata žena;!**Děvica** plelas věnok. — **Děvica** radovala sa.", "!**Děvica** plelas věnok. — **Děvica** radovala sa."], [567, "doroslaj-n", "eb465cef83f2ca8318728a6655caefbb48e2acc12d00b4fe68144e8a197c7e52", null, null]],
    [[502, "diavol-n", "0c86ae42291041246a6948e52f31b457cf8b0b8216aac48f87c9693d1bb53c51", null, null]],
    [[503, "dzigit-NOUN", "e08e9ca448bdff7d76f3ead68aa6b108b84fb020b07a3ad7894b21b9c54fcc39", null, null]],
    [[505, "dzip-NOUN", "6031e2f4212923189d3577a9a4b71611b7522ea1a9f6a864f7487cc349505a2e", null, null]],
    [[506, "divadlo-n", "0255c41933183f15b2deecd5598ed6488ed23d8b77673868f6a0ae8b95a376ea", null, null]],
    [[507, "diviti se-VERB", "b3f191dc3ed3af76c183be9df699042d9b2be9213f8ae1d7c9d14d6e307ff138", null, null]],
    [[508, "divo-n", "1af84e0db2bec3967495a84e7fd5739fd1889e502c5efaa17db4c6f624ab2d25", null, null]],
    [[509, "divo-n", "0c09b115a6cea8c96e662635318cca65bf35136801529e3fd5dde9cde12b9ba4", null, null]],
    [[511, "dolgotrajny-ADJ", "3ed42f582327927bc04021ddf0977e782a1c7da2d4b21952f09e688c021ab3a3", null, null]],
    [[512, "dlanecky-NOUN", "7ef1bd51649e36a622032172924e9d4f411623fb0c0be71065f8d09f4a57ef43", null, null]],
    [[517, "dnesj-adv", "c5fab06546f9424c3b8a2bc93eb557d99f337de1404e089de7e2de8c6257aab1", null, null]],
    [[518, "dnesno-ADV", "4e44b7ef39e4fb3293d0f3b94500c97d484ea0717eae7969427b864bbb33070b", null, null]],
    [[519, "dnesny-ADJ", "c78560acbc3d87fcf1cd32efdfe7b09ccfa08d92799e5c23894339d4aa53bbe9", null, null]],
    [[521, "dnestrograd-NOUN", "81cd66d1cce4f93f9c95447e122e1973df236f844ad77011c494be1c149e82f3", null, null]],
    [[524, "do srestanja-X", "386d3e1ad68a598dfb8ea5611950b1123265368fd442c8e5a11dfce5cd6734c3", null, null]],
    [[525, "do ssrecy-X", "dcfc826b0f8f014354b3ffbae9b9ce708bf5e7f509744aea3e9a52ede818448f", null, null]],
    [[526, "do vidzenja-X", "3097bb0461f97d09832f3bb678d1d1072821f446f48cb93128505067b07f97f1", null, null]],
    [[529, "dobro-adv", "3582b2e7d41a667f8a6d594b8716b56613b4d8ef3e00616f1f32d96ab95f2bb3", null, null]],
    [[530, "dobrodosli-X", "b76eb3eee6ac2e4e2fb03813c61a2e89a934b589a4c96123f14b468dbf431375", null, null]],
    [[531, "dobrojakostny-adj", "49d2b33032547b3572788647ec35d2ccb2dac8466831976d2e05aeba46244578", null, null]],
    [[532, "dobrokrytec-n", "5c18e271a9244d867dafc73523d911becbb38a139098485296dce4ccef650c5e", null, null]],
    [[533, "dobrorekati-v", "337da87d6573e11944838837a01c36b1ea7b78f294cea8918ec66f5c83673fc5", null, null]],
    [[534, "dobrost-NOUN", "3f20b9e4db29140324cd44fa016c31e7251eaaa70c958cad8f0e4e82938317a7", null, null]],
    [[537, "dobrovoljno-adv", "cb8bf498ec7643b87a523ad8ac4d3517ade7a697de6754373837b823b4681fdc", null, null]],
    [[541, "docela-ADV", "7db244fb8dfcfb96e8771b92f8d10a696c1cba26de02f76e5508749ecc83ce24", null, null]],
    [[542, "docela-ADV", "7ed187c6459b2f2fe340d81f3254acc2e3155868fdb6304fb0b1a8f850c1d2f5", null, null]],
    [[543, "dodatek-n", "8ba25a59997e8f0a735703842dd56507c64db8d1c3a7de9367cde72711330dea", null, null]],
    [[545, "dodatk-n", "f210649a83d3f2e46dc247e1d33da37db9179157daea9efe1e3cf008da55401e", null, null]],
    [[546, "dodomu-adv", "10802baf79708563e84e92313ffc6b91e59ddd0f59d5f5da5fe985e151ec1c48", null, null]],
    [[549, "dojdati-v", "9ccc5a9976d6fa4597429e2a6051ea4fe3322c2dc1ef9c76aacd225c781ff19f", null, null]],
    [[551, "dokonca-n", "3b90202c7c6f6b19441cdf56c15abeb274ae6bcbdf2083d999628c61498a1245", null, null]],
    [[553, "dolgostj-n", "220a2f52972589a268e726d5590a6a73f1f2b3b725aa56d1163c573f2aa8b45d", null, null]],
    [[554, "dolgy-adj", "785b63612ff2922434be21b16a9c97874b02cbfcf4c7c86bc5520d40dcb33569", "dȯlgy;ktory imaie velilku dųgość v prostranstvě abo dųgy period vrěmene, dlinnyj;*Oni prěveli **dȯlgy** transportny hod prěz pėščanu pustynų Azije.*", "!Meč byl stvorjeny ako **dolgy** nož.\n*Oni prěveli **dȯlgy** transportny hod prěz pėščanu pustynų Azije.*"]],
    [[557, "domacij-ADJ", "ba3a871a2dcc3def5b22a62c818106b4b38a5fd62bfafd88057662a93954dab3", null, null]],
    [[558, "domar-n", "e1ef95f112bbd6f5f158c4b6f5f1da3f3eac9718506b786c58b2573c8df9d03a", null, null]],
    [[559, "domoljubije-n", "4fd500fd5b228aeb4e20c34f423c26e40316675a76be0fbd08bbf6801318b0c7", null, null]],
    [[560, "domorodec-n", "875ab5183abbe6c358dbf22d893afbddef92bd1a0ec1fc19c449e141c94d2586", null, null]],
    [[564, "donec seversky-n", "c2a45d454a74ca4a6a38f6506c7ab15d25420da9622f0f601ccfb76cf70e964b", null, null]],
    [[565, "dopad-n", "3541ed4c9676f98947996f520c1f90b674ac67c31d8288f84f56ba78274c2650", null, null]],
    [[566, "dorecy-X", "a165087e06a9a78a4765e0fb45c99ea9fbedeff131fc6926ed83b3f7a43effb2", null, null]],
    [[568, "dorosly-adj", "8ac66197045dc3efa186f0e5b41d2c1c3e500df9ab4528d50fad8854c9a38c23", null, null]],
    [[569, "dorostati-v", "b00dc66ea6f6d7e9e51d4c8dfeb42a823d661ca8129c38b20fb7cabd64723673", null, null]],
    [[570, "dorostnik-n", "890006e50909c75ffbb380fd9a76c8f19883d55419f9f6419065c3ae615fa9c0", null, null]],
    [[571, "dorozumiti-v", "72538d260ebdd9ebbbbf7828a556a112b7b3f34edd11669b32461dc745f4c80b", null, null]],
    [[572, "doslati-v", "36b6d14a2d970ff88f509a13a0663e88cf94510c9ef0ff54401f007efe19cfa3", null, null]],
    [[573, "doslati se-VERB", "c73bbfe8f6c106c633a2c7505b799cf6dcd7cf1186416465cdb97c7a2c14590a", null, null]],
    [[575, "dostatocno-ADV", "58f3c453af9b5d6cad4e6c4af916bf89afe7894453176dd05e0139f9e2df1151", "dostatȯčno;v neoridnoj, lěpšej měrě, dosť dlja rěšeńja zadaci, dostatočno;*Tuta nova baza danyh rabotaie **dostatȯčno** hitro prěz modernu sěť.*", "!Životinam je potrěbno shranjati prohladu i nahoditi **dostatočno** jedy i vody, že by prěžiti.\n*Tuta nova baza danyh rabotaie **dostatȯčno** hitro prěz modernu sěť.*"]],
    [[576, "dostavec-n", "3d0f39a6b0e19cab641ceff3a2031ea5d725409a938bb394830ae28904cf7d2b", null, null]],
    [[577, "dovera-NOUN", "ab3fa1d6b1421bcbeacb31e7f4ed33bc132464deb39cebe2a8b4f89ae98c4f4a", null, null]],
    [[580, "dovidzane-X", "59df30314f9c988da29236d290d71fd7678529a0f0e32e1eadc637f23022edb8", null, null]],
    [[581, "dovidzane-NOUN", "fd72ee8e4d02e314427a648d81763b7667e76b33eaf5c6b9681f562b5b0bf5ec", null, null]],
    [[582, "dovolj-adv", "cb494a9393d8c91bc87e170fcf080fb91fc0f443bdb5e1cd6178dabcbd50bad8", null, null]],
    [[585, "dovozati-VERB", "1cb990a2d05defcae2947bd020bcec02e680ef8f046613118669d44eddc6687e", null, null]],
    [[586, "dovozny-adj", "c8afb314fbcff8896ee1cdcd4b1b0c278590ee6973396ef7c709d3b4e1109275", null, null]],
    [[587, "dovozny-adj", "58f6e28ad1eb94118b241b8cb431dff8e5b3f61fe46edccb7f6a53f785a45e23", null, null]],
    [[591, "dramopisec-n", "75c97bda9038100ad50d90d42f91a434c611f5a0f485acabca39d5e13e4fed38", null, null]],
    [[592, "dranik-n", "0c86c0e53fbf13e6030f48b3e3dd0d313a56194f5cffca755071629d4f9e4e38", null, null]],
    [[594, "drega-NOUN", "f9133d2bcd1328d10bde26143ab08834df77a3e9396783d701e466b51b429372", null, null]],
    [[595, "dregati-VERB", "cd0ba9e85b1d1893ceab615bc7a1f44a7c0f853944f02cb96f8702caadba2156", null, null]],
    [[596, "drehly-ADJ", "64a671799c29170e82671b48cb17b655ac7664537ba8025b83e0cf0f9a06cbbb", null, null]],
    [[597, "drevo-n", "70d9c397f544a899925af0e3e31474963f40e4e7f6c1b106fcacbd9b56a0a95c", "drěvo;velilka lěsna rastlina s močnym tvrdym klynom, kořenьem i zelenymi listami, derevo;*Prěkrasny boćan stvoril svoje gnězdo vyšejsšo на starom **drěvě**.*", "!\n*Prěkrasny boćan stvoril svoje gnězdo vyšejsšo на starom **drěvě**.*"]],
    [[598, "drezdzjany-NOUN", "ce9839c589f36210d1d5d3be0b7109be4d95d1c495bded3e7fe9acc74a901115", null, null]],
    [[599, "drozza-NOUN", "7dc4dff035b558d7351e81a49319751166350d7260642db22f8b9a9795826170", null, null]],
    [[600, "drugar-NOUN", "10979317501c9f1752fa1f2d1ee00b4719232f7a8822d67c37de3e873025d512", null, null]],
    [[601, "drugostranny-ADJ", "1a3f2aabc1e075da373dea045e854a687a8d3fa66713892b09d89191f2998701", null, null]],
    [[602, "drugy-ADJ", "e397a6022a87b3731fdb0fc669d11624490a0c0e29b1f6721790753aa4a5118e", null, null]],
    [[603, "druhly-ADJ", "4efe912e33bb3052d281c5e651d0b7bb0a83e97314e187375149da8bc4b0ac39", null, null]],
    [[608, "druzinar-NOUN", "1474e687c1e66ed140025c70005f561e1f0e35a37ed4ac604c76223d82ab12d5", null, null]],
    [[609, "druzinar-NOUN", "63294b5cbb4e1846a22d23ff1554d296b0cd7a689bb86dd008b8f2c3bbce875d", null, null]],
    [[610, "druzinar-NOUN", "1a3249721878b5bb87cf5effb871697809b8c541820d67c45fc8f9f6bb12b290", null, null]],
    [[611, "druzinnik-NOUN", "4b6314b2f9d9af557f5520f700d31f454d74d309ae65b9d964a662a6abdcb508", null, null]],
    [[612, "druzinny-ADJ", "b64ad243b1ac08c78e0fa4a5fc4334024fae66f6e75a6f2b579232e6c8cdc6ac", null, null]],
    [[613, "druzstevny-ADJ", "3cb39f74cd4c9d882aa22a0f26a2dc735bdf1aaaf6a614f7fdc1ba8ed08abe5b", null, null]],
    [[616, "dubna-NOUN", "0127da89c65da78eacc94b6daa2d64e942e9db774443cbd65c9dc69b66836598", null, null]],
    [[617, "dubrava-NOUN", "8c24a3ad3a8422695e544f726bf7fa061b5094e8811c53d7c6896eb5db34b0b1", null, null]],
    [[620, "dlg-n", "21b864393fff403de1b0053ca2601994687c5acdb93e34f3ff50e837eb848ee7", null, null]],
    [[621, "dlzina-NOUN", "e962be1baa5c8c285095b33909651ac7b377a7d30f9a8e576d18be038024ada5", null, null]],
    [[622, "dunava-n", "2bde81ee42bd4965ce87f7e73858f4130c8b5246da1539924318ad52322199fe", null, null]],
    [[623, "durenj-n", "f1ac1a38d0956b7136f7ecb7a31347e933f2d1745f20033816586dae7df69ffe", "durėnj;člověk, muža, ktory postupaѥ velmi glupo, без razuma i logiky, durak;*Ne budь **durėnj**, neoridno brati cěnne djenjezi bez avtorizacije.*", "!\n*Ne budь **durėnj**, neoridno brati cěnne djenjezi bez avtorizacije.*"]],
    [[626, "drzati se-VERB", "ba0c99a10aa8ae0316610e8aa5ac4cada5344a5214e5f137f10a56dd666b0249", null, null]],
    [[627, "drzava-NOUN-2", "625b3960a754537887a01987bfa097319f1b673e9f8c7ef24a65747d515f1c2f", null, null]],
    [[628, "drzava-NOUN-2", "536cd9313caed02559a427f777f2d7592c740c4dd15624953a7dc74b69dbf2af", null, null]],
    [[629, "drzavljanin-NOUN", "4b1d61692275b4acc9ed5e0a956e5344973cf4dc8fc323510df818c673cf3f60", null, null]],
    [[630, "drzavljanka-NOUN", "b2558e652d262ef8dbe5d1b5b2900f7bb8beb0dc0a50215294e029d3e1fae626", null, null]],
    [[631, "drzavljansky-ADJ", "2c764d26860afc88cdd4a2a294ea039e37960f13c3ff4c2e14517864e01c4130", null, null]],
    [[632, "drzavljanstvo-NOUN", "8f96acc0b92d419939d5c2caa64eeb130197f90b2cf36b1b72a973037f0a6720", null, null]],
    [[633, "drzavnostj-NOUN", "027695bce6b0e8e575c2e07bdb4f4f4bf9a4094fa0e81f67109f817276d27bfa", null, null]],
    [[634, "drzavny-ADJ-2", "ae9d3f001f11647d621d82b393fdb8d04138d2f96150d5f361cab6d85c778edb", "dŕžavny;ktory tyče sę države, urędny, kancelaŕsky, upevnjeny prěz zakon, gosudarstvennyj;*Glavny **dŕžavny** budžet byl spentovany на strojeńje avtomagistrale.*", "!Srbija uznavaje **državnu** granicu od dnešnoj pozicije rěky.\n*Glavny **dŕžavny** budžet byl spentovany на strojeńje avtomagistrale.*"]],
    [[635, "drzavny-ADJ-2", "31cb697f76b30391ffeed7b8f06aebb5574e8d0efc6d4a61781bd0f12c099198", null, null]],
    [[636, "drzky-adj", "05577d96109cf8135f7812fb54b676f8c91a674626f8375107abb813c8677a11", null, null]],
    [[637, "drzostj-n", "48a72b48b777602f7b570db8dae67cc1170431d3991e9b7640a70ad3b9ea4e40", null, null]],
    [[638, "drzy-adj", "13fbddf7b9c9d6db66ddcfe5ad57461c533f41479dee05194fa7f77bd1d798a8", null, null]],
    [[640, "dusec-NOUN", "0a92e57588cd7ebb1218cd30be1e333497852283da27fe921e3756c9b205895b", null, null]],
    [[641, "dzut-NOUN", "a1b1a1e4f259a41da11fb9e17bc2bf05d67cc4bbe4bd6b0cd1adaf575245bfbf", null, null]],
    [[642, "dzdzj-NOUN", "c9dcc702955256972b12881ff2beba7848ecbde74cce7c509f11335ffdc0e583", null, null]],
    [[643, "dvzy-ADJ", "fd51a2172db8ea38ff11194e3a5c02b4dc55503eb68f139d201d0ba5f003af2d", null, null]],
    [[645, "dvadeset-NUM", "bedc052b45895fe918e99aa6e59ab1e4c397bab8e93045e9ce450242c18b33e0", null, null]],
    [[646, "dvadesetirocinny-ADJ", "6587cdfd8c1d012d6a588c5bb0efbc255907bcec149f60c46028ed0a45edaa61", null, null]],
    [[647, "dvadzy-ADV", "137b399d4a94494f9ffacc95ee9ccef631f3a2cb23ca3dc6420d553eabb71cbe", null, null]],
    [[648, "dvajce-NUM", "e6d88e57638952c377fae5114bd51b777ddee618c366f34c7f6a941047a8281c", null, null]],
    [[649, "dvanadeset-NUM", "6982e78989d48bb633498a928d32c38c95d22cc7948e23fbed3e941c1527ec5a", null, null]],
    [[650, "dvanajce-NUM", "92ecbf76472c43c74df06088ca6c4bb24ce48d1c7e30b7d63160c67d1bca50f2", null, null]],
    [[651, "dverj-n", "8e7aa00b2294e4d0641dc9190a4901a2a6c9b7f62889f857510f1459a8b6c5bc", null, null]],
    [[653, "dvina severna-n", "da268ce816c3d979b84b8d08a01b7c194fdc9fb80e34d8d8a12def28a3ca9957", null, null]],
    [[654, "dvinsk-n", "03d6934df079f3738a7fb51ad307d744d03944589e538068f3abec8c9be3abce", null, null]],
    [[655, "dvizota-NOUN", "068b80d147ecf9d1914b8faf14f148d250ae6feef6f1872b765e966bbed25253", null, null]],
    [[656, "dvobrat-n", "fdcd1313f14d91cd071171a3334a978df7a9a820a6c12175bb7ba81c33cb30c6", null, null]],
    [[657, "dvoglavy-ADJ", "12f08ab77b8251dd793d4ba0eb793dbec7316266b39dd1b47d4b57efa3c2a396", null, null]],
    [[658, "dvohdnjovy-adj", "cb555fa81ecc606cfd98cd8fc9a8c275893a58ca235e0247c816db6f0ad04909", null, null]],
    [[659, "dvohrocinny-ADJ", "aa64f54355e8edc31173871b57ac8c08585cad8d01722609d90959a7dfe3b918", null, null]],
    [[660, "dvohsty-adj", "efcc89cf3d39a6e1126e2d7a7a5acb8d8ccd32c10c0f5bd1e77c827e4010a262", null, null]],
    [[662, "dvojak-n", "7b4ff9f3005b6a7012036555f98739e7d2589e043fb33408ee5979e90113ca1c", null, null]],
    [[663, "dvojaky-adj", "8cbcbb6e4a5e9b35f14fdfdd28a7ae65cfb5030cadaf535d0a8428746073b4e6", null, null]],
    [[664, "dvoiazycny-ADJ", "1cc989c7b4c7eccbb8a0f591d212666a9696aa2c7fdcf1062f58b111a5853379", null, null]],
    [[665, "dvojica-n", "89267d47c30064cfedd695d3a92d372325eddbcdfd24234da2870e15e0c60d98", null, null]],
    [[666, "dvoiodusny-ADJ", "392aab1a3a8ac50cbe42bf01dd1eb6eae7a2efb51847227605145af4f099da3f", null, null]],
    [[667, "dvojokol-n", "a73f2d3df1d6db94a9216e20f90dc5360f9ecf34fb597d13e2c38c22cc4f9b92", null, null]],
    [[668, "dvojokolar-n", "27fbd3d6349b0fc6e23cb06abacf2b7c15a58ab35f3783450cca2b0e7a4a6eff", null, null]],
    [[669, "dvoiotcka-NOUN", "1c32741ef39fe87dc0a87d3babc4aa1ea30a4a8c7e3a9007827e96f5e16d5301", null, null]],
    [[670, "dvoiovlastny-ADJ", "a0964b2df49c435ca8853396d4fde91d5fa53be0304a86764ccfedd45c02d79f", null, null]],
    [[671, "dvoiozenec-NOUN", "449ebfd0b3d6ea6b9160c2ced5902a30b8beb5f4924f75f0bab0d46e9561dc69", null, null]],
    [[672, "dvoiozenstvo-NOUN", "5235c62385965dd6def7842f41d5ffc67546ce6c2fcb9c4bbc9c7764ea46917b", null, null]],
    [[673, "dvokratno-ADV", "8bf43f0b1c856f8229d408e62748ae0d0270e323552842ddab8996c9cdac7b91", null, null]],
    [[674, "dvokratno-ADV", "cc5a90dd783c60bf47f4e99042c3c7d35f4057eaade5143248620df4a6fdf0a6", null, null]],
    [[675, "dvokraty-ADV", "fbc3eb0906fe95c0e349d2de2e787e618bef28a89ab737988e0968fe28c1591b", null, null]],
    [[676, "dvokraty-ADV", "8af89d6c464247464c97c3fe66ab15c2b17d68c19a1153dd46cd8ff66abe3743", null, null]],
    [[677, "dvonogy-adj", "d3db6954d5391497dfb8abe91358bc4c95fa43b088b318f4e839b418744b801f", null, null]],
    [[679, "dvorec-n", "cf5d18157b8de3bc6e40934f18300e75b1d7d78c216092c994c1169c65d1fa8c", null, null]],
    [[680, "dvorovy-adj", "d1910abaef6d403259a70f011aaa4c288980974cd94e0fdabc59694eda8b4198", null, null]],
    [[681, "dvosestra-n", "1ccb2ecbca7686438f613e0d1981dfaf161f48fdea6e07aa79e36c45980b165f", null, null]],
    [[682, "dvuboj-n", "21365ac89a1e3d24fa6e0cd654f2e67aa352aa7aa9a6ec8a3a7414e806539607", null, null]],
    [[683, "dvubojec-n", "ca7c5def6734d806ff4dbf8ad134b4d7a602dc157718b6e0c2817e5cf9e61a43", null, null]],
    [[684, "dy-pron", "e8d92bda92873f707bd710eccaa91b6603e1f8867859a294c3d1c9c1e816020c", null, null]],
    [[686, "dynja-n", "aa3c0d3180ce2cb785243555f329806308c3851780c76641abc3ac351c8f6232", null, null]],
    [[687, "dira-NOUN", "d4ce0020c97260917c5759b99b47f1ef9c03ab08ab0b763331abe1f5cc0c5338", "dira;zlamanoje, otvoryte prostranstvo v klynu drěva, stěně, koži abo sųkńě, otverstije;*Maly barsuk utěkł prěz glubokų **dirų** pod stěnoju sělskogo doma.*", "!\n*Maly barsuk utěkł prěz glubokų **dirų** pod stěnoju sělskogo doma.*"]],
    [[688, "efiopsky-ADJ", "8a6947d1eea1ff0a7975b561ebf28bd2289f302016077b04f95dc831fcd0cdbe", null, null]],
    [[689, "efiopy-NOUN", "bb0b8d5632bdf3d9e85fc7dbc6a3d5908f3b21cae996042d6b6107ad42b9536b", null, null]],
    [[690, "egjejsko morje-NOUN", "251813af288f50772b016d289823943f4f1775838ce73678bc0fe15041dba781", null, null]],
    [[691, "egipet-n", "b2156c2128cbe1b4db29c3895cbc34f00d095d6be44961c8df3d0eb4777aa679", null, null]],
    [[692, "egipetsky-adj", "964881657dc39a344d9e637dac8018e49b71ce93892282814c0aa87e47e45348", null, null]],
    [[693, "egiptenin-NOUN", "b539793c76bb08e6a5ece28f663a23edab8d10c4379654fd7fd8c6a4ee98eb67", null, null]],
    [[694, "egoiizm-NOUN", "2add64a0b8ef3c0136a2342024667a54056ca536fe36162e062f1d0b1ec882e4", null, null]],
    [[695, "eh-PART", "8adbf84e25af5d1b923c638f766ea503cb7ab1d794380114aa4e97b22fecf65c", null, null]],
    [[696, "eh-PART", "8ac92417b831255111875a79e1868b8ff5800d7436f59cab407f661a90d2c2a6", null, null]],
    [[697, "ehnij-ADJ", "f06a4d41f58fc6b9a42868a7f44eacfaecf79f23dd8a5f47ce3a25769cec98f8", null, null]],
    [[698, "eko-PART", "d67935d2e9fde5fef3d4d8e68b78bbf87385846e73ab2f21aee2ce5588454338", null, null]],
    [[699, "ekonomika-NOUN-2", "0c3c396910a0f80a9616aa0b2296acef87490c9ddc5304ca90d29af672f988cb", null, null]],
    [[700, "eksotika-NOUN", "5b1554152e5f5908e8348b3c9fda90636f32aba738963da5d66450d3935b3da3", null, null]],
    [[701, "ekran-NOUN-2", "66f60576d176d360ecc10f9168e2093627fb7be4dda11a39a3819311a6adaff3", null, null]],
    [[702, "elektricnostj-NOUN", "dcf87258cc47bc32d0c8e4570400fbf4e5200e3839af1d25fb26b8c0984102d5", null, null]],
    [[703, "elektrina-NOUN", "83db5296507eeaccaf056dfcc7995e48ded9ad8793319f65001952fff4177fd4", null, null]],
    [[704, "erfskobrod-NOUN", "7be339c100ca9d3d3e002020b8a93c791c125c1451de629b42e726409fe1109e", null, null]],
    [[705, "erzja-NOUN", "37a40f2f4e9929a81f601ff92e37b81aa02963900a2a7dd04a87b5a83f04c7fb", null, null]],
    [[706, "erzjancy-NOUN", "be1cc6b817bed16d5cad46e33e03fb1b264d4d96f64de68755ea406beefd9405", null, null]],
    [[707, "erzjansky-ADJ", "9669d1f799a8cd883b32fc7f33f0b5c1aad3e40ba66ba4fb12db329d0cdbd1d1", null, null]],
    [[708, "etrusky-ADJ", "7b20a465e6b49e12f4bd2b936686bb87e8a982c326e08713186192dad84416a2", null, null]],
    [[709, "etrussky-ADJ", "ef1a3ee384902d5dfce9d421e00b5d4e4797e8bc62775a68339e0c8f35ec062f", null, null]],
    [[710, "evoljuciia-NOUN", "ddddcb811d7b3e228f645cc155ac5cc0b33b4e4d539447ff03873a918b31a5b9", null, null]],
    [[711, "evfemizm-NOUN", "7275b75941b113eebe506447e2b4860e82c26ba6fe5b3507727d4b756c7481a5", null, null]],
    [[4986, "akcija-NOUN", "372e2c4f795d666da0a7b27d28816a5c6b24ad8a7ce4903305a4618b209b0594", "Cěnna kanceńarijska bumuža-ljst, kora kaze dolju inside jměńje fabrike;akcija (finans.).;*On kupił novu cěnnu **akciju** inside centralnoj tgovle-f_irmě.*", "!\n*On kupił novu cěnnu **akciju** inside centralnoj tgovle-f_irmě.*"], [4987, "akcija-NOUN", "39f73831c4116421cfa4cec2b450b15ba8988d39b3da70ecbc979086462c72b5", "Public-dzełańje ljuđej, radosny festival, abo vojsko-natjsk;akcija, dzełańje-aktj.;*Nova radosna **akcija** mlådeži počęła se на centralnom trgu.*", "!\n*Nova radosna **akcija** mlådeži počęła se на centralnom trgu.*"]],
    [[5895, "blagosklonny-ADJ", "34ac30a49b88758c819a295eedf07c5f9039f26eab89cf2a01d253829ffb570a", "blågosklonny;ktory dastaie lěpše uslovija, pomaže uspečnomu koncu, blågoprijatny;*Oni čekali na **blågosklonny** moment, da by zapustiti novy biznes.*", "!\n*Oni čekali na **blågosklonny** moment, da by zapustiti novy biznes.*"], [5896, "blagosklonny-ADJ", "c720739834bf783acc0a6c7262abfd338698d8011458aabe6102906300d55e4b", "blågosklonny;člověk, ktory imaie dobru volų i actively pomaga inym s pomočju vlasti;*Tuten **blågosklonny** direktor avtorizoval naš proekt bez dųgih prověrok.*", "!\n*Tuten **blågosklonny** direktor avtorizoval naš proekt bez dųgih prověrok.*"]],
]
const apply = process.argv.includes("--apply")
const db = new Database(process.env.SQLITE_DB ?? "interlex.db", { readonly: !apply, fileMustExist: true })

try {
    const getMeaning = db.prepare<[number], MeaningRow>(`
        SELECT m.lexemeId, l.slug, m.meaning, m.examples,
               m.meaningVerified, m.examplesVerified, m.meaningMessage, m.examplesMessage
        FROM meanings m JOIN lexemes l ON l.id = m.lexemeId
        WHERE m.id = ?
    `)
    const getTranslations = db.prepare<[number], { language: string; value: string }>(`
        SELECT DISTINCT language, value FROM translations
        WHERE meaningId = ? AND language IN ('ru', 'en') AND trim(value) <> ''
        ORDER BY language, value
    `)

    function plan() {
        const changes: { id: number; slug: string; old: TextFields; next: TextFields }[] = []
        let skipped = 0
        let done = 0

        for (const group of groups) {
            const edits = group.map(([id, slug, before, meaning, examples]) => {
                const row = getMeaning.get(id)
                const next = { meaning, examples }
                if (!row || row.slug !== slug) return { id, slug, next }
                const fingerprint = createHash("sha256").update(JSON.stringify([
                    row.lexemeId, row.slug, row.meaning, row.examples,
                    row.meaningVerified, row.examplesVerified, row.meaningMessage, row.examplesMessage,
                    getTranslations.all(id).map(({ language, value }) => [language, value]),
                ])).digest("hex")
                return { id, slug, row, next, fingerprint, before }
            })
            if (edits.every(({ row, next }) => row && row.meaning === next.meaning && row.examples === next.examples)) {
                done += group.length
                continue
            }
            if (edits.some(({ row, before, fingerprint }) => !row || fingerprint !== before)) {
                skipped += group.length
                console.log(`Конфликт с текущими данными: ${edits.map(({ id, slug }) => `${id} ${slug}`).join(", ")}`)
                continue
            }
            for (const edit of edits) {
                if (edit.row) changes.push({ id: edit.id, slug: edit.slug, old: edit.row, next: edit.next })
            }
        }
        return { changes, skipped, done }
    }

    const result = apply ? db.transaction(() => {
        const result = plan()
        const update = db.prepare("UPDATE meanings SET meaning = ?, examples = ?, updatedAt = ? WHERE id = ?")
        const audit = db.prepare(`
            INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userEmail)
            VALUES (?, 'Meaning', ?, ?, ?, ?, 'script:realign-meaning-texts')
        `)
        const actionId = randomUUID()
        const now = new Date().toISOString()
        for (const { id, old, next } of result.changes) {
            update.run(next.meaning, next.examples, now, id)
            for (const field of ["meaning", "examples"] as const) {
                if (old[field] !== next[field]) audit.run(actionId, id, field, old[field], next[field])
            }
        }
        return result
    }).immediate() : db.transaction(plan)()

    for (const { id, slug, next } of result.changes) {
        console.log(`${id} ${slug}: ${next.meaning?.split("\n")[0] ?? "без определения"}`)
    }
    console.log(`${apply ? "Применено" : "К исправлению"}: ${result.changes.length}. Уже исправлено: ${result.done}. Конфликты: ${result.skipped}.`)
} finally {
    db.close()
}
