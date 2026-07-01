import { declineNoun, IntegratedFormRequest } from '../declineNoun';
import { StemType } from '../endingsRegistry';

// Test data for various word types
const testWords = [
    {
        name: 'bog (masculine, o-hard, paradigm A)',
        word: 'bog',
        paradigm: 'A' as const,
        stemType: 'o_hard' as StemType,
        gender: 'masculine' as const,
        expectedForms: {
            singular: {
                nominative: 'bógъ',
                accusative: 'bógъ',
                genitive: 'bóga',
                dative: 'bógu',
                instrumental: 'bogómъ',
                locative: 'bogcě',
                vocative: 'bóge'
            },
            plural: {
                nominative: 'bógi',
                accusative: 'bógy',
                genitive: 'bógъ',
                dative: 'bogómъ',
                instrumental: 'bógy',
                locative: 'bogcěxъ',
                vocative: 'bógi'
            },
            dual: {
                nominative: 'bóga',
                accusative: 'bóga',
                genitive: 'bógu',
                dative: 'bogóma',
                instrumental: 'bogóma',
                locative: 'bógu',
                vocative: 'bóga'
            }
        }
    },
    {
        name: 'ruka (feminine, a-hard, paradigm B)',
        word: 'ruk',
        paradigm: 'B' as const,
        stemType: 'a_hard' as StemType,
        gender: 'feminine' as const,
        expectedForms: {
            singular: {
                nominative: 'ruká',
                accusative: 'rukǫ',
                genitive: 'ruký',
                dative: 'rukě',
                instrumental: 'rukóju',
                locative: 'rukě',
                vocative: 'ruko'
            },
            plural: {
                nominative: 'ruky',
                accusative: 'ruky',
                genitive: 'rukъ',
                dative: 'rukamъ',
                instrumental: 'rukami',
                locative: 'rukahъ',
                vocative: 'ruky'
            },
            dual: {
                nominative: 'rukě',
                accusative: 'rukě',
                genitive: 'ruku',
                dative: 'rukama',
                instrumental: 'rukama',
                locative: 'ruku',
                vocative: 'rukě'
            }
        }
    },
    {
        name: 'syn (masculine, u-basis, paradigm C)',
        word: 'syn',
        paradigm: 'C' as const,
        stemType: 'u_basis' as StemType,
        gender: 'masculine' as const,
        expectedForms: {
            singular: {
                nominative: 'sýnъ',
                accusative: 'sýnъ',
                genitive: 'synú',
                dative: 'synóvi',
                instrumental: 'synъ́mъ',
                locative: 'sýnu',
                vocative: 'sýnu'
            },
            plural: {
                nominative: 'synov́e',
                accusative: 'sýny',
                genitive: 'synóvъ',
                dative: 'synъ́mъ',
                instrumental: 'synъ́mi',
                locative: 'synъ́xъ',
                vocative: 'synov́e'
            },
            dual: {
                nominative: 'sýny',
                accusative: 'sýny',
                genitive: 'synovju',
                dative: 'synъ́ma',
                instrumental: 'synъ́ma',
                locative: 'synovju',
                vocative: 'sýny'
            }
        }
    },
    {
        name: 'kost (i-basis, paradigm A)',
        word: 'kost',
        paradigm: 'A' as const,
        stemType: 'i_basis' as StemType,
        gender: 'feminine' as const,
        expectedForms: {
            singular: {
                nominative: 'kóstь',
                accusative: 'kóstь',
                genitive: 'kostí',
                dative: 'kostí',
                instrumental: 'kostьjǫ́',
                locative: 'kostí',
                vocative: 'kostí'
            },
            plural: {
                nominative: 'kostí',
                accusative: 'kostí',
                genitive: 'kostьjъ́',
                dative: 'kostьmъ́',
                instrumental: 'kostьmí',
                locative: 'kostьxъ́',
                vocative: 'kostí'
            },
            dual: {
                nominative: 'kostí',
                accusative: 'kostí',
                genitive: 'kostьjú',
                dative: 'kostьmá',
                instrumental: 'kostьmá',
                locative: 'kostьjú',
                vocative: 'kostí'
            }
        }
    },
    {
        name: 'tělo (neuter, a-hard, paradigm C)',
        word: 'těl',
        paradigm: 'C' as const,
        stemType: 'a_hard' as StemType,
        gender: 'neuter' as const,
        expectedForms: {
            singular: {
                nominative: 'tě́lo',
                accusative: 'tě́lo',
                genitive: 'tě́la',
                dative: 'tě́lu',
                instrumental: 'tělómъ',
                locative: 'tělě́',
                vocative: 'tě́lo'
            },
            plural: {
                nominative: 'telá',
                accusative: 'telá',
                genitive: 'tělъ',
                dative: 'tělómъ',
                instrumental: 'tě́ly',
                locative: 'tělěxъ́',
                vocative: 'telá'
            },
            dual: {
                nominative: 'tělě́',
                accusative: 'tělě́',
                genitive: 'tě́lu',
                dative: 'tělóma',
                instrumental: 'tělóma',
                locative: 'tě́lu',
                vocative: 'tělě́'
            }
        }
    }
];

function runTests() {
    console.log('=== Testing declineNoun function ===\n');
    
    let passedTests = 0;
    let failedTests = 0;
    
    for (const testData of testWords) {
        console.log(`Testing: ${testData.name}`);
        console.log(`Word stem: "${testData.word}"`);
        console.log(`Paradigm: ${testData.paradigm}, Stem type: ${testData.stemType}\n`);
        
        for (const number of ['singular', 'plural', 'dual'] as const) {
            for (const caseName of ['nominative', 'accusative', 'genitive', 'dative', 'instrumental', 'locative', 'vocative'] as const) {
                const request: IntegratedFormRequest = {
                    interslavicWord: testData.word,
                    paradigm: testData.paradigm,
                    stemType: testData.stemType,
                    targetCase: caseName,
                    targetNumber: number
                };
                
                try {
                    const result = declineNoun(request);
                    const expected = testData.expectedForms[number][caseName];
                    
                    if (result === expected) {
                        passedTests++;
                        console.log(`✓ ${number}.${caseName}: "${result}"`);
                    } else {
                        failedTests++;
                        console.log(`✗ ${number}.${caseName}: Expected "${expected}", got "${result}"`);
                    }
                } catch (error) {
                    failedTests++;
                    console.log(`✗ ${number}.${caseName}: Error - ${error}`);
                }
            }
        }
        console.log('');
    }
    
    console.log('=== Test Summary ===');
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Total: ${passedTests + failedTests}`);
    
    if (failedTests === 0) {
        console.log('\n✓ All tests passed!');
    } else {
        console.log('\n✗ Some tests failed.');
    }
}

runTests();
