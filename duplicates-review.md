# Дубли по омонимам: список на разбор

Класс — что различается у сторон. `soft` = мягкие диакритики (ě/ę/ȯ/ų/ė/ŕ);
`HARD` = č/š/ž/đ против c/s/z/d (разные буквы ISV — там же лежат разные слова);
`letters` = различие в i/y и подобном. Русские переводы приведены, чтобы видеть смысл.

Отметьте решение в колонке «решение»: `merge` — слить B в A (или наоборот), `keep` — оставить как есть.


## value:= | stem:soft — 52 пар

### 2257 токенов · 21 групп форм (prěd, prědže, pred)
- A: pred-NOUN · value=pred · stem=prěd · NOUN/Masc · 635/млн
- B: pred-n · value=pred · stem=pred · NOUN/Masc · 42/млн
- ru(A): перед, передняя сторона, лицевая сторона
- ru(B): Перёд
- решение: merge B->A

### 685 токенов · 20 групп форм (česti, čestju, čęsti)
- A: čestj-n · value=cestj · stem=čest · NOUN/Fem · 203/млн
- B: čęstj-n · value=cestj · stem=čęst · NOUN/Fem · 4/млн
- ru(A): Честь
- ru(B): Часть
- решение: <!-- merge B->A | merge A->B | keep - Некорректная граммема n вместо NOUN и диакритика в value (правда будет полное совпадение потом, надо тоже как-то решать). А так и то, и то сохраняем - разные слова -->

### 666 токенов · 34 групп форм (věči, věč, več)
- A: večj-n · value=vecj · stem=več · NOUN/Fem · 114/млн
- B: věčj-n · value=vecj · stem=věč · NOUN/Fem · 345/млн
- ru(A): Вещь
- ru(B): Вещь
- решение: <!-- merge B->A | merge A->B | keep - граммема некорректное, а также диакритика в value, но сливаем потом A->B -->

### 478 токенов · 2 групп форм (najprvo, najpŕvo)
- A: najprvo-ADV · value=najprvo · stem=najpŕv · ADV · 13/млн
- B: najprvo-adv · value=najprvo · stem=najprv · ADV · 136/млн
- ru(A): прежде всего
- ru(B): вначале
- решение: merge B->A

### 321 токенов · 30 групп форм (pogled, pogleda, pogledi)
- A: pogled-NOUN · value=pogled · stem=poględ · NOUN/Masc · 219/млн
- B: poglěd-n · value=pogled · stem=poglěd · NOUN/Masc · 148/млн
- ru(A): взгляд, взор; вид, обзор
- ru(B): Точка зрения; Взгляд; Взор
- решение: merge B->A

### 252 токенов · 33 групп форм (prědmet, prědmety, prědmetov)
- A: predmet-NOUN · value=predmet · stem=prědmet · NOUN/Masc · 218/млн
- B: predmět-n · value=predmet · stem=predmět · NOUN/Masc · 4/млн
- ru(A): предмет, объект, вещь; дополнение (грам.); предмет, артикул, изделие; предмет, тема, вопрос
- ru(B): Курс; Предмет
- решение: merge B->A

### 233 токенов · 4 групп форм (hlapec, hlåpèc, hlåpec)
- A: hlapec-NOUN · value=hlapec · stem=hlåpėc · NOUN/Masc · 157/млн
- B: hlåpec-n · value=hlapec · stem=hlåpec · NOUN/Masc · 3/млн
- ru(A): парень, ребята (мн.); мужик, чувак, парень, пацан, тип
- ru(B): Мальчик; Парень
- решение: merge B->A

### 230 токенов · 11 групп форм (deset, deseti, desęť)
- A: deset-NUM · value=deset · stem=desęť · NUM · 89/млн
- B: desět-num · value=deset · stem=desět · NUM · 4/млн
- ru(A): десять
- ru(B): Десять
- решение:merge B->A

### 229 токенов · 18 групп форм (srědině, srědiny, srědina)
- A: sredina-NOUN · value=sredina · stem=srědin · NOUN/Fem · 108/млн
- B: sredina-n · value=sredina · stem=sredin · NOUN/Fem · 7/млн
- ru(A): середина
- ru(B): Центр; Средина
- решение: merge B->A

### 219 токенов · 9 групп форм (věš, ves, veś)
- A: ves-NOUN · value=ves · stem=vėś · NOUN/Fem · 229/млн
- B: ves-n · value=ves · stem=ves · NOUN/Masc · 64/млн
- ru(A): деревня
- ru(B): Счастье
- решение: <!-- merge B->A | merge A->B | keep - не очень понятно, какие примеры в В, как будто ошибочное слово -->

### 203 токенов · 14 групп форм (čestno, čestny, čestnym)
- A: cestny-ADJ · value=cestny · stem=čėstn · ADJ · 0/млн
- B: čęstny-adj · value=cestny · stem=čęstn · ADJ · 84/млн
- ru(A): честный, справедливый, благородный
- ru(B): частный
- решение: <!-- merge B->A | merge A->B | keep - диакритика во втором и граммема неверная, но должно быть два слова -->

### 176 токенов · 18 групп форм (meč, męč, mečem)
- A: mec-NOUN · value=mec · stem=meč · NOUN/Masc · 84/млн
- B: měč-n · value=mec · stem=měč · NOUN/Masc · 16/млн
- ru(A): меч; мяч
- ru(B): Мечтать
- решение: <!-- merge B->A | merge A->B | keep - диакритика во втором и граммема неверная, но два разных слова (měčt во втором основа, почему т пропало?) -->

### 129 токенов · 24 групп форм (pracuje, pracovati, pracoval)
- A: pracovati-VERB · value=pracovati · stem=pracova · VERB · 104/млн
- B: pråcovati-v · value=pracovati · stem=pråcova · VERB · 1/млн
- ru(A): работать, трудиться
- ru(B): делать
- решение: merge B->A (но stem pråcova верный, в А потерялась диакритика в stem)

### 124 токенов · 17 групп форм (vlastny, vlastne, vlastnogo)
- A: vlastny-ADJ · value=vlastny · stem=vlastn · ADJ · 172/млн
- B: vlåstny-adj · value=vlastny · stem=vlåstn · ADJ · 1/млн
- ru(A): собственный; подходящий, надлежащий, соответствующий
- ru(B): властелин
- решение: merge B->A (но stem vlåstn верный, в А потерялась диакритика в stem)

### 74 токенов · 9 групп форм (utrom, utro, utra)
- A: utro-NOUN · value=utro · stem=utr · NOUN/Neut · 52/млн
- B: ųtro-n · value=utro · stem=ųtr · NOUN/Neut · 0/млн
- ru(A): утро; утро
- ru(B): Нутро
- решение: <!-- merge B->A | merge A->B | keep --> - диакритика (будут совпадать) и граммема во втором неверные, но слова разные, нужно сохранить оба

### 60 токенов · 22 групп форм (madjarsky, madjarskom, madjarskogo)
- A: madjarsky-ADJ · value=madjarsky · stem=madjaŕsk · ADJ · 0/млн
- B: madjarsky-adj · value=madjarsky · stem=madjarsk · ADJ · 68/млн
- ru(A): венгерский
- ru(B): мадьярский
- решение: merge B->A

### 58 токенов · 14 групп форм (sudba, sudbu, sudby)
- A: sudba-NOUN · value=sudba · stem=sųďb · NOUN/Fem · 6/млн
- B: sųdba-n · value=sudba · stem=sųdb · NOUN/Fem · 34/млн
- ru(A): судьба
- ru(B): Судьба
- решение: merge B->A

### 56 токенов · 5 групп форм (gospod, gospodi, gospodži)
- A: gospod-NOUN · value=gospod · stem=gospoď · NOUN/Masc · 3/млн
- B: gospod-n · value=gospod · stem=gospod · NOUN/Masc · 23/млн
- ru(A): господин, владыка, повелитель
- ru(B): Господь
- решение: merge B->A

### 54 токенов · 5 групп форм (petdeset, pęťdesęť, petdeseti)
- A: petdeset-NUM · value=petdeset · stem=pęťdesęt · NUM · 0/млн
- B: pętdesęt-num · value=petdeset · stem=pętdesęt · NUM · 25/млн
- ru(A): пятьдесят
- ru(B): пятдесят
- решение: merge B->A

### 54 токенов · 2 групп форм (tvorec, tvorecь)
- A: tvorec-NOUN · value=tvorec · stem=tvorėc · NOUN/Masc · 38/млн
- B: tvorec-n · value=tvorec · stem=tvorec · NOUN/Masc · 16/млн
- ru(A): создатель, творец
- ru(B): Автор
- решение: merge B->A

### 50 токенов · 12 групп форм (prědsědnik, prědsědnikom, predsednika)
- A: predsednik-NOUN · value=predsednik · stem=prědsědnik · NOUN/Masc · 23/млн
- B: predsědnik-n · value=predsednik · stem=predsědnik · NOUN/Masc · 0/млн
- ru(A): председатель
- ru(B): Президент
- решение: merge B->A

### 42 токенов · 11 групп форм (gospodar, gospodara, gospodari)
- A: gospodar-NOUN · value=gospodar · stem=gospodaŕ · NOUN/Masc · 1/млн
- B: gospodar-n · value=gospodar · stem=gospodar · NOUN/Masc · 22/млн
- ru(A): хозяин, домохозяин; землевладелец
- ru(B): Господин; Эконом
- решение: merge B->A

### 38 токенов · 29 групп форм (věda, vědaju, vědati)
- A: vedati-v · value=vedati · stem=veda · VERB · 9/млн
- B: vědati-v · value=vedati · stem=věda · VERB · 42/млн
- ru(A): Вести
- ru(B): Ведать; Знать
- решение: <!-- merge B->A | merge A->B | keep --> - граммема и диакритика неверные в обоих, но слова оба существуют

### 32 токенов · 7 групп форм (trny, trnami, trna)
- A: trn-NOUN · value=trn · stem=tŕn · NOUN/Masc · 0/млн
- B: trn-n · value=trn · stem=trn · NOUN/Masc · 13/млн
- ru(A): шип, колючка
- ru(B): Тёрн
- решение: merge B->A

### 30 токенов · 2 групп форм (zločinèc, zločinec)
- A: zlocinec-NOUN · value=zlocinec · stem=zločinėc · NOUN/Masc · 56/млн
- B: zločinec-n · value=zlocinec · stem=zločinec · NOUN/Masc · 4/млн
- ru(A): преступник
- ru(B): Преступник; Злодей
- решение: merge B->A

### 26 токенов · 12 групп форм (rěčnik, rečnik, rěčniku)
- A: recnik-NOUN · value=recnik · stem=rěčnik · NOUN/Masc · 14/млн
- B: rečnik-n · value=recnik · stem=rečnik · NOUN/Masc · 5/млн
- ru(A): словарь
- ru(B): Лексика; Разговорник
- решение: merge B->A

### 23 токенов · 8 групп форм (cěsarstva, cěsarstvo, cěsarstvu)
- A: cesarstvo-NOUN · value=cesarstvo · stem=cěsaŕstv · NOUN/Neut · 0/млн
- B: cěsarstvo-n · value=cesarstvo · stem=cěsarstv · NOUN/Neut · 13/млн
- ru(A): империя, цесарство, царство
- ru(B): Царство
- решение: merge B->A

### 21 токенов · 18 групп форм (tegnuti, tegnul, tegne)
- A: tegnuti-VERB · value=tegnuti · stem=tęgnų · VERB · 25/млн
- B: tęgnuti-v · value=tegnuti · stem=tęgnu · VERB · 1/млн
- ru(A): тянуть, тащить, влечь
- ru(B): Тащить
- решение: merge B->A

### 17 токенов · 8 групп форм (rybar, rybara, rybaru)
- A: rybar-NOUN · value=rybar · stem=rybaŕ · NOUN/Masc · 1/млн
- B: rybar-n · value=rybar · stem=rybar · NOUN/Masc · 10/млн
- ru(A): рыболов, рыбак
- ru(B): Рыбарь
- решение: merge B->A

### 15 токенов · 10 групп форм (drugar, drugari, drugaru)
- A: drugar-NOUN · value=drugar · stem=drugaŕ · NOUN/Masc · 0/млн
- B: drugar-n · value=drugar · stem=drugar · NOUN/Masc · 12/млн
- ru(A): товарищ
- ru(B): Знакомый
- решение: merge B->A

### 13 токенов · 7 групп форм (prěvoza, prěvoz, prevožu)
- A: prevoz-NOUN · value=prevoz · stem=prěvoz · NOUN/Masc · 8/млн
- B: prevoz-n · value=prevoz · stem=prevoz · NOUN/Masc · 1/млн
- ru(A): перевозка, транспортировка; паром, челнок, трансфер
- ru(B): Перевоз
- решение: merge B->A

### 12 токенов · 3 групп форм (dobrosti, dobrost, dobrosť)
- A: dobrost-NOUN · value=dobrost · stem=dobrosť · NOUN/Fem · 1/млн
- B: dobrostj-n · value=dobrost · stem=dobrost · NOUN/Fem · 5/млн
- ru(A): добро, благость
- ru(B): Добро
- решение: merge B->A

### 12 токенов · 6 групп форм (sěmejstvo, sěmejstva, semejstvo)
- A: semejstvo-NOUN · value=semejstvo · stem=sěmėjstv · NOUN/Neut · 0/млн
- B: sěmejstvo-n · value=semejstvo · stem=sěmejstv · NOUN/Neut · 8/млн
- ru(A): семейство, домочадцы
- ru(B): Семья
- решение: merge B->A

### 12 токенов · 5 групп форм (zločinstva, zločinstvo, zločinstv)
- A: zlocinstvo-NOUN · value=zlocinstvo · stem=zločiństv · NOUN/Neut · 0/млн
- B: zločinstvo-n · value=zlocinstvo · stem=zločinstv · NOUN/Neut · 9/млн
- ru(A): преступление
- ru(B): Преступность; Злодейство
- решение: merge B->A

### 11 токенов · 2 групп форм (lovec, loveč)
- A: lovec-NOUN · value=lovec · stem=lovėc · NOUN/Masc · 11/млн
- B: lovec-n · value=lovec · stem=lovec · NOUN/Masc · 3/млн
- ru(A): слон (шахматы); охотник
- ru(B): Ловец
- решение: merge B->A

### 11 токенов · 4 групп форм (vsemira, vsemir, vsemiru)
- A: vsemir-NOUN · value=vsemir · stem=vsemir · NOUN/Masc · 8/млн
- B: vsěmir-n · value=vsemir · stem=vsěmir · NOUN/Masc · 0/млн
- ru(A): вселенная, мир
- ru(B): Космос
- решение: merge B->A

### 10 токенов · 5 групп форм (skaredno, skaredny, skaredni)
- A: skaredny-ADJ · value=skaredny · stem=skaredn · ADJ · 2/млн
- B: skarędny-adj · value=skaredny · stem=skarędn · ADJ · 0/млн
- ru(A): безобразный, уродливый, гадкий, отвратительный
- ru(B): скаредный; мерзкий
- решение:  merge B->A (но stem верный в A - skarędn, там юс)

### 9 токенов · 6 групп форм (gradonačelnik, gradonačelnika, gradonačelnikov)
- A: gradonacelnik-NOUN · value=gradonacelnik · stem=grådonačęľnik · NOUN/Masc · 0/млн
- B: grådonačelnik-n · value=gradonacelnik · stem=grådonačelnik · NOUN/Masc · 6/млн
- ru(A): мэр, градоначальник
- ru(B): Мэр
- решение: merge B->A

### 8 токенов · 16 групп форм (oglašam, oglasi, oglašati)
- A: oglasati-VERB · value=oglasati · stem=oglaša · VERB · 9/млн
- B: oglåšati-v · value=oglasati · stem=oglåša · VERB · 0/млн
- ru(A): оглашать, объявлять
- ru(B): Объявлять
- решение: merge B->A (но stem верный в A - oglåša)

### 7 токенов · 1 групп форм (borec)
- A: borec-NOUN · value=borec · stem=borėc · NOUN/Masc · 5/млн
- B: borec-n · value=borec · stem=borec · NOUN/Masc · 4/млн
- ru(A): борец, боец
- ru(B): Поборник
- решение: merge B->A

### 7 токенов · 4 групп форм (mahnul, mahnula, mahnuvši)
- A: mahnuti-VERB · value=mahnuti · stem=mahnų · VERB · 0/млн
- B: mahnuti-v · value=mahnuti · stem=mahnu · VERB · 4/млн
- ru(A): махнуть
- ru(B): изъять
- решение: merge B->A

### 7 токенов · 8 групп форм (plen, plěn, plena)
- A: plen-NOUN · value=plen · stem=plěn · NOUN/Masc · 1/млн
- B: plen-n · value=plen · stem=plen · NOUN/Masc · 7/млн
- ru(A): добыча, трофей
- ru(B): Плен
- решение: merge B->A

### 6 токенов · 1 групп форм (sěčenj)
- A: secenj-NOUN · value=secenj · stem=sěčėn · NOUN/Masc · 2/млн
- B: sěčenj-n · value=secenj · stem=sěčen · NOUN/Fem · 6/млн
- ru(A): январь
- ru(B): Февраль
- решение: merge B->A (но перевод из второго забираем)

### 5 токенов · 4 групп форм (kraba, krabi, krab)
- A: krab-NOUN · value=krab · stem=krab · NOUN/Masc · 3/млн
- B: kråb-n · value=krab · stem=kråb · NOUN/Masc · 0/млн
- ru(A): краб; краб
- ru(B): Короб
- решение: keep (диакритика во втором)

### 4 токенов · 1 групп форм (gusljar)
- A: gusljar-NOUN · value=gusljar · stem=gųsljaŕ · NOUN/Masc · 0/млн
- B: gusljar-n · value=gusljar · stem=gusljar · NOUN/Masc · 1/млн
- ru(A): скрипач
- ru(B): Гусляр
- решение: merge B->A (перевод из второго забираем)

### 4 токенов · 8 групп форм (neznačna, neznačno, neznačne)
- A: neznacny-ADJ · value=neznacny · stem=neznačn · ADJ · 5/млн
- B: něznačny-adj · value=neznacny · stem=něznačn · ADJ · 0/млн
- ru(A): незначительный, несущественный, ничтожный
- ru(B): неопределённый
- решение: keep (диакритика и граммема во втором)

### 4 токенов · 4 групп форм (črěvu, črěva, črevo)
- A: crevo-NOUN · value=crevo · stem=črěv · NOUN/Neut · 2/млн
- B: črevo-n · value=crevo · stem=črev · NOUN/Neut · 0/млн
- ru(A): кишка, брюхо
- ru(B): Живот
- решение: merge B->A 

### 3 токенов · 1 групп форм (mladenec)
- A: mladenec-NOUN · value=mladenec · stem=mlådenėc · NOUN/Masc · 5/млн
- B: mlådenec-n · value=mladenec · stem=mlådenec · NOUN/Masc · 0/млн
- ru(A): подросток
- ru(B): Младенец
- решение: merge B->A

### 3 токенов · 1 групп форм (palec)
- A: palec-NOUN · value=palec · stem=palėc · NOUN/Masc · 3/млн
- B: palec-n · value=palec · stem=palec · NOUN/Masc · 1/млн
- ru(A): дюйм
- ru(B): Палец
- решение: merge B->A

### 2 токенов · 2 групп форм (črěda, čreda)
- A: creda-NOUN · value=creda · stem=črěd · NOUN/Fem · 1/млн
- B: čreda-n · value=creda · stem=čred · NOUN/Fem · 1/млн
- ru(A): стадо, гурт, вереница (животных)
- ru(B): Чреда
- решение: merge B->A

### 1 токенов · 1 групп форм (nedě)
- A: nede-adv · value=nede · stem=ned · ADV · 8/млн
- B: něde-adv · value=nede · stem=něd · ADV · 0/млн
- ru(A): негде
- ru(B): Где-то; Где-либо; Где-нибудь
- решение: keep (диакритика и граммемы)

### 1 токенов · 2 групп форм (žrěbe, žrěbę)
- A: zrebe-NOUN · value=zrebe · stem=žrěben · NOUN/Neut · 0/млн
- B: žrebę-n · value=zrebe · stem=žreben · NOUN/Neut · 1/млн
- ru(A): жеребёнок
- ru(B): Жеребенок
- решение: merge B->A (stem проверь, чтоб корректно склонялось. Вообще žrěbent праславянская основа, но возможно stem должен быть žrěb)


## value:= | stem:HARD — 12 пар

### 793 токенов · 45 групп форм (cěly, cělo, cělom)
- A: celo-NOUN · value=celo · stem=čel · NOUN/Neut · 42/млн
- B: cělo-n · value=celo · stem=cěl · NOUN/Neut · 94/млн
- ru(A): лоб; лоб; передняя часть, фасад
- ru(B): Целое
- решение: keep, диакритика и граммема во втором

### 417 токенов · 11 групп форм (budučnosti, budučnost, bųdųćnosti)
- A: buducnost-NOUN · value=buducnost · stem=bųdųćnosť · NOUN/Fem · 17/млн
- B: bųdučnostj-n · value=buducnost · stem=bųdučnost · NOUN/Fem · 160/млн
- ru(A): будущее
- ru(B): Будущее; Будущность
- решение:  merge B->A

### 74 токенов · 13 групп форм (mråza, mråz, mraz)
- A: mraz-NOUN · value=mraz · stem=mråz · NOUN/Masc · 62/млн
- B: mråž-n · value=mraz · stem=mråž · NOUN/Masc · 6/млн
- ru(A): мороз
- ru(B): Морж
- решение: keep (диакритика и граммема во втором)

### 39 токенов · 2 групп форм (plaži, plaž)
- A: plaz-NOUN · value=plaz · stem=plaž · NOUN/Fem · 17/млн
- B: plåz-n · value=plaz · stem=plåz · NOUN/Masc · 0/млн
- ru(A): пляж
- ru(B): Полоз
- решение: keep (диакритика и граммема во втором)

### 36 токенов · 10 групп форм (ležati, ležal, ležala)
- A: lezati-VERB · value=lezati · stem=leža · VERB · 68/млн
- B: lězati-v · value=lezati · stem=lěza · VERB · 2/млн
- ru(A): лежать; лежать
- ru(B): лезть
- решение: проверить ять во втором, гнезда оба сохраняем (диакритика и граммема во втором)

### 33 токенов · 11 групп форм (brěza, brězy, brěz)
- A: breza-NOUN · value=breza · stem=brěz · NOUN/Fem · 25/млн
- B: breža-n · value=breza · stem=brež · NOUN/Fem · 4/млн
- ru(A): берёза
- ru(B): Забота
- решение: игнор, ниже разбираются оба пункта по своим гнездам

### 14 токенов · 8 групп форм (lisa, liš, lis)
- A: lis-n · value=lis · stem=lis · NOUN/Masc · 9/млн
- B: liš-n · value=lis · stem=liš · NOUN/Masc · 2/млн
- ru(A): Лис
- ru(B): Лишь
- решение: keep (во втором диаритика, в обоих граммемы неверные)

### 9 токенов · 5 групп форм (tesano, tesana, tesane)
- A: tesati-VERB · value=tesati · stem=tesa · VERB · 5/млн
- B: těšati-v · value=tesati · stem=těša · VERB · 6/млн
- ru(A): тесать, вытёсывать
- ru(B): тешить
- решение: keep (во втором диакритика и граммема остались неверными)

### 6 токенов · 9 групп форм (zelo, zele, žela)
- A: zelo-NOUN · value=zelo · stem=žęl · NOUN/Neut · 0/млн
- B: zelo-n · value=zelo · stem=zel · NOUN/Neut · 14/млн
- ru(A): жало
- ru(B): Капуста
- решение: keep (граммема во втором, первое скорее stem должен быть с dl - žędl)

### 5 токенов · 3 групп форм (sěv, šev, sev)
- A: sev-NOUN · value=sev · stem=šėv · NOUN/Masc · 37/млн
- B: sěv-n · value=sev · stem=sěv · NOUN/Masc · 25/млн
- ru(A): шов
- ru(B): Сев
- решение: keep (но осталась диакритика во втором и граммема неверная)

### 1 токенов · 3 групп форм (zebra, zebry, żebro)
- A: zebra-NOUN · value=zebra · stem=zebr · NOUN/Fem · 1/млн
- B: žębra-n · value=zebra · stem=žębr · NOUN/Fem · 0/млн
- ru(A): зебра
- ru(B): Жабра
- решение: keep (но во втором диакритика осталась в value)

### 1 токенов · 1 групп форм (čapajeve)
- A: capati-v · value=capati · stem=capa · VERB · 0/млн
- B: čapati-v · value=capati · stem=čapa · VERB · 0/млн
- ru(A): Хватать
- ru(B): хватать
- решение: merge B-> A


## value:soft | stem:soft — 9 пар

### 742 токенов · 4 групп форм (dostatočno, dostatòčno, dostatȯčno)
- A: dostatočno-adv · value=dostatocno · stem=dostatočn · ADV · 219/млн
- B: dostatȯcno-ADV · value=dostatȯcno · stem=dostatȯčn · ADV · 0/млн
- ru(A): Достаточно
- ru(B): достаточно, довольно
- решение: merge B -> A (но stem верный в B)

### 135 токенов · 12 групп форм (vozhodu, vozhoda, vozhod)
- A: vozhod-n · value=vozhod · stem=vozhod · NOUN/Masc · 71/млн
- B: vȯzhod-NOUN · value=vȯzhod · stem=vȯzhod · NOUN/Masc · 2/млн
- ru(A): Восход
- ru(B): восток
- решение:merge A-> B (диакритика осталась)

### 119 токенов · 16 групп форм (sovět, sověta, sověty)
- A: sovět-n · value=sovet · stem=sovět · NOUN/Masc · 98/млн
- B: sȯvet-NOUN · value=sȯvet · stem=sȯvět · NOUN/Masc · 0/млн
- ru(A): Совет
- ru(B): совет, подсказка
- решение: merge A-> B (диакритика осталась)

### 31 токенов · 2 групп форм (kol, kół)
- A: kol-NOUN · value=kol · stem=kol · NOUN/Masc · 24/млн
- B: kȯl-NOUN · value=kȯl · stem=kȯl · NOUN/Masc · 6/млн
- ru(A): кол; кол
- ru(B): клык
- решение: keep

### 22 токенов · 6 групп форм (dolgotrajny, dolgotrajne, dolgotrajnoj)
- A: dolgotrajny-adj · value=dolgotrajny · stem=dolgotrajn · ADJ · 10/млн
- B: dȯlgotrajny-ADJ · value=dȯlgotrajny · stem=dȯlgotrajn · ADJ · 0/млн
- ru(A): продолжительный
- ru(B): долгоиграющий, долго длящийся
- решение: merge A-> B (диакритика осталась)

### 17 токенов · 3 групп форм (plot, płot, plotь)
- A: plot-NOUN · value=plot · stem=plot · NOUN/Masc · 18/млн
- B: plȯt-NOUN · value=plȯt · stem=plȯť · NOUN/Fem · 1/млн
- ru(A): забор, ограда, изгородь
- ru(B): цвет лица; плоть, кожа
- решение: keep (но осталась во втором диакритика)

### 13 токенов · 7 групп форм (volgy, volga, volgi)
- A: volga-NOUN · value=volga · stem=volg · NOUN/Fem · 10/млн
- B: vȯlga-NOUN · value=vȯlga · stem=vȯlg · NOUN/Fem · 0/млн
- ru(A): Волга; Волга
- ru(B): иволга
- решение: keep (но осталась во втором диакритика)

### 13 токенов · 10 групп форм (vozvratil, vozvratiti, vozvratili)
- A: vozvråtiti-v · value=vozvratiti · stem=vozvråti · VERB · 11/млн
- B: vȯzvratiti-VERB · value=vȯzvratiti · stem=vȯzvråti · VERB · 0/млн
- ru(A): Вернуть
- ru(B): возвратить, вернуть
- решение: merge A-> B (Но диакритика осталась)

### 4 токенов · 7 групп форм (vozvratna, vozvratny, vozvratne)
- A: vozvråtny-adj · value=vozvratny · stem=vozvråtn · ADJ · 5/млн
- B: vȯzvratny-ADJ · value=vȯzvratny · stem=vȯzvråtn · ADJ · 0/млн
- ru(A): Возвратный
- ru(B): повторный, повторяющийся
- решение: merge A-> B (но диакритика осталась)


## value:letters | stem:letters — 8 пар

### 1603 токенов · 4 групп форм (ti, tí, tì)
- A: ti-PRON · value=ti · stem=ti · PRON · 18/млн
- B: ty-PRON · value=ty · stem=ty · PRON · 5663/млн
- ru(A): тебе
- ru(B): ты; ты
- решение: merge A-> B

### 551 токенов · 5 групп форм (bil, bih, bihmo)
- A: biti-VERB · value=biti · stem=bi · VERB · 307/млн
- B: byti-VERB · value=byti · stem=by · VERB · 70924/млн
- ru(A): бить
- ru(B): быть; быть, являться, иметься; существовать; есть; есть, существуют
- решение: keep

### 470 токенов · 3 групп форм (više, vi, vih)
- A: viti-VERB · value=viti · stem=vi · VERB · 30/млн
- B: vyti-VERB · value=vyti · stem=vy · VERB · 10/млн
- ru(A): вить, свивать, скручивать; оплетать, обвивать; вить (гнездо); покрывать, обвивать; вить, плести
- ru(B): выть; выть, вопить
- решение: keep

### 4 токенов · 2 групп форм (dirah, dirami)
- A: dira-NOUN · value=dira · stem=dir · NOUN/Fem · 43/млн
- B: dyra-n · value=dyra · stem=dyr · NOUN/Fem · 4/млн
- ru(A): дыра, отверстие
- ru(B): Дыра
- решение: merge B-> A

### 2 токенов · 1 групп форм (mogili)
- A: mogila-n · value=mogila · stem=mogil · NOUN/Fem · 2/млн
- B: mogyla-NOUN · value=mogyla · stem=mogyl · NOUN/Fem · 9/млн
- ru(A): Могила
- ru(B): могила, захоронение
- решение: merge A-> B

### 1 токенов · 1 групп форм (nabi)
- A: nabiti-VERB · value=nabiti · stem=nabi · VERB · 1/млн
- B: nabyti-VERB · value=nabyti · stem=naby · VERB · 12/млн
- ru(A): набить, начинить, зарядить
- ru(B): приобрести, завести
- решение: keep

### 1 токенов · 2 групп форм (pribih, pribiše)
- A: pribiti-VERB · value=pribiti · stem=pribi · VERB · 1/млн
- B: pribyti-VERB · value=pribyti · stem=priby · VERB · 26/млн
- ru(A): прибить
- ru(B): прибыть; прибыть
- решение: keep

### 1 токенов · 1 групп форм (slista)
- A: sliti-VERB · value=sliti · stem=sli · VERB · 7/млн
- B: slyti-VERB · value=slyti · stem=sly · VERB · 28/млн
- ru(A): слить, соединить, смешать
- ru(B): слыть, быть известным
- решение: keep


## value:= | stem:= — 7 пар  (это и есть SAFE — value и stem совпадают буквально)

### 4874 токенов · 5 групп форм (či, či, ci)
- A: ci-CCONJ · value=ci · stem=či · CCONJ · 0/млн
- B: či-conj · value=ci · stem=či · CCONJ · 1384/млн
- ru(A): ли, или
- ru(B): если
- решение: merge B-> A
### 2046 токенов · 34 групп форм (drugyh, druge, drugy)
- A: drugy-ADJ · value=drugy · stem=drug · ADJ · 0/млн
- B: drugy-adj · value=drugy · stem=drug · ADJ · 3277/млн
- ru(A): другой, иной
- ru(B): другой; второй
- решение: merge B-> A

### 993 токенов · 3 групп форм (blizko, blízko, bližko)
- A: blizko-ADV · value=blizko · stem=blizk · ADV · 0/млн
- B: blizko-adv · value=blizko · stem=blizk · ADV · 273/млн
- ru(A): близко, рядом
- ru(B): около
- решение: merge B-> A

### 32 токенов · 13 групп форм (ljuty, ljutogo, ljuta)
- A: ljuty-ADJ · value=ljuty · stem=ljut · ADJ · 0/млн
- B: ljuty-adj · value=ljuty · stem=ljut · ADJ · 25/млн
- ru(A): лютый, жестокий, суровый
- ru(B): крепкий
- решение: merge B-> A

### 22 токенов · 10 групп форм (děvice, device, děvica)
- A: devica-NOUN · value=devica · stem=děvic · NOUN/Fem · 0/млн
- B: děvica-n · value=devica · stem=děvic · NOUN/Fem · 14/млн
- ru(A): девственница
- ru(B): Девица
- решение: merge B-> A

### 16 токенов · 21 групп форм (opustil, opustila, opustiti)
- A: opustiti-VERB · value=opustiti · stem=opusti · VERB · 0/млн
- B: opustiti-v · value=opustiti · stem=opusti · VERB · 22/млн
- ru(A): оставить, покинуть, бросить; опустить, наклонить; ослабить, разжать, отпустить
- ru(B): забросить; закинуть
- решение: merge B-> A

### 8 токенов · 4 групп форм (vlakna, vlaknom, vlakno)
- A: vlakno-NOUN · value=vlakno · stem=vlåkn · NOUN/Neut · 0/млн
- B: vlåkno-n · value=vlakno · stem=vlåkn · NOUN/Neut · 3/млн
- ru(A): волокно
- ru(B): Шпагат
- решение: merge B-> A


## value:letters | stem:= — 5 пар

### 539 токенов · 42 групп форм (lěpše, lěpši, lěpša)
- A: lepsi-ADJ · value=lepsi · stem=lěpš · ADJ · 0/млн
- B: lěpšy-adj · value=lepsy · stem=lěpš · ADJ · 294/млн
- ru(A): лучший, более хороший
- ru(B): лучший
- решение: merge A-> B (Но граммема в А)

### 87 токенов · 18 групп форм (byvši, byvšej, byvša)
- A: byvsi-ADJ · value=byvsi · stem=byvš · ADJ · 0/млн
- B: byvšy-adj · value=byvsy · stem=byvš · ADJ · 45/млн
- ru(A): бывший
- ru(B): Бывший
- решение: merge A-> B (Но граммема в А)

### 44 токенов · 15 групп форм (mladši, mladša, mladšego)
- A: mladsi-ADJ · value=mladsi · stem=mlådš · ADJ · 0/млн
- B: mlådšy-adj · value=mladsy · stem=mlådš · ADJ · 34/млн
- ru(A): младший
- ru(B): младший
- решение: merge A-> B (Но граммема в А)

### 37 токенов · 32 групп форм (vysši, vysše, vysšego)
- A: vyssi-ADJ · value=vyssi · stem=vysš · ADJ · 0/млн
- B: vysšy-adj · value=vyssy · stem=vysš · ADJ · 77/млн
- ru(A): выше, более высокий
- ru(B): Высшый; Высший
- решение: merge A-> B (Но граммема в А)

### 12 токенов · 22 групп форм (nizši, nizše, nizšej)
- A: nizsi-ADJ · value=nizsi · stem=nizš · ADJ · 0/млн
- B: nizšy-adj · value=nizsy · stem=nizš · ADJ · 22/млн
- ru(A): ниже, более низкий
- ru(B): низший
- решение: merge A-> B (Но граммема в А)


## value:= | stem:letters — 5 пар

### 46 токенов · 2 групп форм (vkupě, vkupe)
- A: vkupe-ADV · value=vkupe · stem=vkupě · ADV · 13/млн
- B: vkupe-adv · value=vkupe · stem=vkup · ADV · 1/млн
- ru(A): вместе
- ru(B): вкупе
- решение: merge B->A

### 33 токенов · 1 групп форм (brěza)
- A: breza-NOUN · value=breza · stem=brěz · NOUN/Fem · 25/млн
- B: brjoza-n · value=breza · stem=brjoz · NOUN/Fem · 0/млн
- ru(A): берёза
- ru(B): Берёза; Береза
- решение: merge B->A

### 33 токенов · 1 групп форм (brěza)
- A: breža-n · value=breza · stem=brež · NOUN/Fem · 4/млн
- B: brjoza-n · value=breza · stem=brjoz · NOUN/Fem · 0/млн
- ru(A): Забота
- ru(B): Берёза; Береза
- решение: оставить только А (В сливается по предыдущему кейсу)

### 20 токенов · 1 групп форм (vųtrě)
- A: vųtre-adv · value=vutre · stem=vųtr · ADV · 0/млн
- B: vųtrě-adv · value=vutre · stem=vųtrě · ADV · 6/млн
- ru(A): внутри
- ru(B): Внутри
- решение: merge A->B (но граммема неверная)

### 19 токенов · 1 групп форм (karate)
- A: karate-NOUN · value=karate · stem=karat · NOUN/Neut · 0/млн
- B: karaté-n · value=karate · stem=karaté · NOUN/Neut · 0/млн
- ru(A): каратэ
- ru(B): Карате
- решение: merge B->A

