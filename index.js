const fs = require('fs');
const readline = require('readline');

const wpVersions = [
    {
        wp: '5.0',
        php: {
            min: '5.6',
            max: '7.3',
        }
    },
    {
        wp: '5.1',
        php: {
            min: '5.6',
            max: '7.3',
        }
    },
    {
        wp: '5.2',
        php: {
            min: '5.6',
            max: '7.3',
        }
    },
    {
        wp: '5.3',
        php: {
            min: '5.6',
            max: '7.4',
        }
    },
    {
        wp: '5.4',
        php: {
            min: '5.6',
            max: '7.4',
        }
    },
    {
        wp: '5.5',
        php: {
            min: '5.6',
            max: '7.4',
        }
    },
    {
        wp: '5.6',
        php: {
            min: '5.6',
            max: '8.0',
        }
    },
    {
        wp: '5.7',
        php: {
            min: '5.6',
            max: '8.0',
        }
    },
    {
        wp: '5.8',
        php: {
            min: '5.6',
            max: '8.0',
        }
    },
    {
        wp: '5.9',
        php: {
            min: '5.6',
            max: '8.1',
        }
    },
    {
        wp: '6.0',
        php: {
            min: '5.6',
            max: '8.1',
        }
    },
    {
        wp: '6.1',
        php: {
            min: '5.6',
            max: '8.2',
        }
    }
];

const phpVersions = [
    {
        php: '5.6',
        os: 'Debian GNU/Linux 9 (stretch)',
        node: {
            min: '10',
            max: '17'
        }
    },
    {
        php: '7.0',
        os: 'Debian GNU/Linux 9 (stretch)',
        node: {
            min: '10',
            max: '17'
        }
    },
    {
        php: '7.1',
        os: 'Debian GNU/Linux 10 (buster)',
        node: {
            min: '10',
            max: '19'
        }
    },
    {
        php: '7.2',
        os: 'Debian GNU/Linux 10 (buster)',
        node: {
            min: '10',
            max: '19'
        }
    },
    {
        php: '7.3',
        os: 'Debian GNU/Linux 11 (bullseye)',
        node: {
            min: '10',
            max: '19'
        }
    },
    {
        php: '7.4',
        os: 'Debian GNU/Linux 11 (bullseye)',
        node: {
            min: '10',
            max: '19'
        }
    },
    {
        php: '8.0',
        os: 'Debian GNU/Linux 11 (bullseye)',
        node: {
            min: '10',
            max: '19'
        }
    },
    {
        php: '8.1',
        os: 'Debian GNU/Linux 11 (bullseye)',
        node: {
            min: '10',
            max: '19'
        }
    },
    {
        php: '8.2',
        os: 'Debian GNU/Linux 11 (bullseye)',
        node: {
            min: '10',
            max: '19'
        }
    }
];

const compareSemver = (aVersion, bVersion) => {
    // Split the version strings into arrays of integers
    const aParts = aVersion.split('.').map(x => parseInt(x, 10));
    const bParts = bVersion.split('.').map(x => parseInt(x, 10));

    if (aParts.length < bParts.length) {
        const diff = bParts.length - aParts.length;

        for (let index = 0; index < diff; index++) {
            aParts.push(0);
        }
    }

    if (bParts.length < aParts.length) {
        const diff = aParts.length - bParts.length;

        for (let index = 0; index < diff; index++) {
            bParts.push(0);
        }
    }

    // Compare the major versions
    if (aParts[0] !== bParts[0]) {
        return aParts[0] > bParts[0] ? 1 : -1;
    }

    // If the major versions are equal, compare the minor versions
    if (aParts[1] !== bParts[1]) {
        return aParts[1] > bParts[1] ? 1 : -1;
    }

    // If the major and minor versions are equal, compare the patch versions
    if (aParts[2] !== bParts[2]) {
        return aParts[2] > bParts[2] ? 1 : -1;
    }

    // If all three versions are equal, return 0
    return 0;
}

const validateSemver = (semver) => {
    // Use a regular expression to check if the string is in the correct format
    const semverRegex = /^\d+\.\d+(\.\d+)?$/;
    if (!semverRegex.test(semver)) {
        return false;
    }

    // Split the string into an array of integers
    const parts = semver.split('.').map(part => parseInt(part, 10));

    // Check if each part is a non-negative integer
    if (parts.some(part => isNaN(part) || part < 0)) {
        return false;
    }

    return true;
}

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

const generateWordPressSecretKey = () => {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_ []{}<>~`+=,.;:/?|';

    let key = '';

    for (let i = 0; i < 64; i++) {
        key += characters[Math.floor(Math.random() * characters.length)];
    }

    return key;
}

const generateDockerFile = ({
    generateSSHKey,
    gitUserEmail,
    gitUserName,
    outputLocation,
    phpVersion,
    wpVersion,
    nodeVersion,
}) => {
    fs.readFile(`templates/php${phpVersion}/Dockerfile`, 'utf8', (err, template) => {
        if (err) {
            console.error(err);
            return;
        }

        const wpVersionNormalized = 'latest' === wpVersion ? wpVersion : `wordpress-${wpVersion}`;

        const output = template
            .split('\n')
            .filter((line) => {
                if (-1 !== line.indexOf('RUN ssh-keygen -t rsa -N "" -f "$HOME/.ssh/id_rsa"')) {
                    return 'y' === generateSSHKey?.toLowerCase();
                }

                if (-1 !== line.indexOf('{gitUserName}')) {
                    return !!gitUserName;
                }

                if (-1 !== line.indexOf('{gitUserEmail}')) {
                    return !!gitUserName;
                }

                return true;
            })
            .map((line) => {
                return line
                    .replace(new RegExp('{wpVersion}', 'g'), wpVersionNormalized)
                    .replace(new RegExp('{nodeVersion}', 'g'), nodeVersion)
                    .replace(new RegExp('{gitUserName}', 'g'), gitUserName)
                    .replace(new RegExp('{gitUserEmail}', 'g'), gitUserEmail)
            })
            .join('\n');

        fs.writeFile(`${outputLocation}/Dockerfile`, output, (writeFileError) => {
            if (writeFileError) {
                throw writeFileError
            }

            console.log(
                `Successfully created Dockerfile file at ${outputLocation}`
            );
        })
    });
};

const generateDockerCompose = ({
    constants,
    containerId,
    environments,
    network,
    outputLocation,
    shareSSHKey,
    volumes,
}) => {
    fs.readFile('templates/docker-compose.yml', 'utf8', (err, template) => {
        if (err) {
            console.error(err);
            return;
        }

        const output = template
            .split('\n')
            .filter((line) => {
                if (-1 !== line.indexOf('~/.ssh:/root/.ssh:ro')) {
                    return 'y' === shareSSHKey?.toLowerCase()
                }

                if (-1 !== line.indexOf('name: {network}')) {
                    return !!network;
                }

                const lineNoSpace = line.replace(/\s+/g, '');

                return true;
            })
            .map((line) => {
                return line
                    .replace(new RegExp('{containerId}', 'g'), containerId)
                    .replace(new RegExp('{network}', 'g'), network)
            })
            .reduce((accumulator, currentValue) => {
                if (
                    -1 !== currentValue.indexOf('- {environments}')
                ) {
                    if (!environments.length) {
                        return accumulator
                    }

                    return accumulator.concat([
                        ...environments.map((environment) => `      - ${environment}`),
                    ]);
                }

                if (
                    -1 !== currentValue.indexOf('- {volumes}')
                ) {
                    if (!volumes.length) {
                        return accumulator
                    }

                    return accumulator.concat([
                        ...volumes.map((volume) => `      - ${volume}`),
                    ]);
                }

                if (
                    -1 !== currentValue.indexOf('- {wordpressConfigExtra}')
                ) {
                    if (!constants.length) {
                        return accumulator
                    }

                    return accumulator.concat('      - WORDPRESS_CONFIG_EXTRA=', [
                        ...constants.reduce((constantsAccumulator, constant) => {
                            const parts = constant.split('=', 2);

                            return constantsAccumulator.concat([
                                `          if ( ! defined( '${parts[0]}' ) ) {`,
                                `            define( '${parts[0]}', ${parts[1]} );`,
                                `          }`,
                                '',
                            ])
                        }, []),
                    ]);
                }

                return accumulator.concat(currentValue);
            }, [])
            .join('\n');

        fs.writeFile(`${outputLocation}/docker-compose.yml`, output, (writeFileError) => {
            if (writeFileError) {
                throw writeFileError
            }

            console.log(
                `Successfully created docker-compose.yml file at ${outputLocation}`
            );
        })
    });
};

const generateEntryPointScript = ({
    outputLocation,
    phpVersion,
}) => {
    const templateFile = fs.existsSync(`templates/php${phpVersion}/docker-entrypoint.sh`) ? `templates/php${phpVersion}/docker-entrypoint.sh` : `templates/docker-entrypoint.sh`;

    fs.readFile(templateFile, 'utf8', (err, template) => {
        if (err) {
            console.error(err);
            return;
        }

        fs.writeFile(`${outputLocation}/docker-entrypoint.sh`, template, (writeFileError) => {
            if (writeFileError) {
                throw writeFileError
            }

            console.log(
                `Successfully created docker-entrypoint.sh file at ${outputLocation}`
            );
        })
    });
};

const generateWPConfig = ({
    outputLocation,
}) => {
    fs.readFile('templates/wp-config.php', 'utf8', (err, template) => {
        if (err) {
            console.error(err);
            return;
        }

        const output = template.replace(new RegExp('{secretKey}', 'g'), generateWordPressSecretKey);

        fs.writeFile(`${outputLocation}/wp-config.php`, output, (writeFileError) => {
            if (writeFileError) {
                throw writeFileError
            }

            console.log(
                `Successfully created wp-config.php file at ${outputLocation}`
            );
        })
    });
};

const generateHtaccess = ({
    outputLocation,
}) => {
    fs.readFile('templates/.htaccess', 'utf8', (err, template) => {
        if (err) {
            console.error(err);
            return;
        }

        fs.writeFile(`${outputLocation}/.htaccess`, template, (writeFileError) => {
            if (writeFileError) {
                throw writeFileError
            }

            console.log(
                `Successfully created .htaccess file at ${outputLocation}`
            );
        })
    });
};

const getErrorMessage = (question, answer, answers) => {
    const { id, isRequired, validation } = question;

    if ('' === answer && isRequired) {
        return `ERROR: The ${id} input cannot be left blank. Please enter a value.`;
    }

    if ('' !== answer && validation) {
        const isValid = validation.call(null, answer, answers);

        if (false === isValid) {
            return `ERROR: The ${id} input is invalid.`;
        }

        if ('string' === typeof isValid) {
            return `ERROR: ${isValid}`;
        }
    }

    return null;
}

const askQuestion = (rl, question, defaultAnswer, answers) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });

        if (defaultAnswer) {
            if ('function' === typeof defaultAnswer) {
                rl.write(defaultAnswer(answers));
            } else {
                rl.write(defaultAnswer);
            }
        }
    });
};

const askQuestions = (questions) => {
    return new Promise(async (resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const answers = [];

        for (let i = 0; i < questions.length; i++) {
            const { id, text, defaultAnswer, isRequired, isSkip, isRepeat } = questions[i];

            if (isSkip && isSkip.call(null, answers)) {
                continue;
            }

            let repeatCounter = 1;
            let question = isRequired ? `(*) ${text}` : `(?) ${text}`

            let answer = await askQuestion(rl, isRepeat ? `${question} (#${repeatCounter}) ` : `${question} `, defaultAnswer, answers)

            if (isRepeat) {
                const answersRepeat = [];

                while ('' !== answer) {
                    answersRepeat.push(answer)

                    answer = await askQuestion(rl, `${question} (#${++repeatCounter}) `, defaultAnswer, answers)
                }

                answer = answersRepeat.filter((value, index, self) => self.indexOf(value) === index);
            }

            const errorMessage = getErrorMessage(questions[i], answer, answers);

            if (errorMessage) {
                console.log(errorMessage);
                i--;
            } else {
                answers.push({
                    id,
                    answer,
                });
            }
        }

        rl.close();

        resolve(answers);
    });
};

askQuestions([
    {
        id: 'wpVersion',
        text: 'Please enter the WordPress version:',
        defaultAnswer: 'latest',
        isRequired: true,
        validation: (wpVersion) => {
            if ('latest' === wpVersion) {
                return true;
            }

            if (!validateSemver(wpVersion)) {
                return false;
            }

            const wpVersionParts = wpVersion.split('.');
            const wpVersionMajor = wpVersionParts?.[0] ?? 0;
            const wpVersionMinor = wpVersionParts?.[1] ?? 0;

            if (!wpVersions.find(v => v.wp === `${wpVersionMajor}.${wpVersionMinor}`)) {
                const wpVersionMin = wpVersions[0].wp;
                const wpVersionMax = wpVersions[(wpVersions.length - 1)].wp;

                return `The allowed range of WordPress versions is from ${wpVersionMin} to ${wpVersionMax}.`;
            }

            return true;
        }
    },
    {
        id: 'phpVersion',
        text: 'Please enter the PHP version:',
        defaultAnswer: (answers) => {
            let wpVersion = answers.find(answer => 'wpVersion' === answer.id)?.answer ?? '';

            if ('latest' === wpVersion) {
                wpVersion = wpVersions[(wpVersions.length - 1)].wp;
            }

            if (!validateSemver(wpVersion)) {
                return '';
            }

            const wpVersionParts = wpVersion.split('.');
            const wpVersionMajor = wpVersionParts?.[0] ?? 0;
            const wpVersionMinor = wpVersionParts?.[1] ?? 0;

            return wpVersions.find(v => v.wp === `${wpVersionMajor}.${wpVersionMinor}`)?.php?.max ?? '';
        },
        isRequired: true,
        validation: (phpVersion, answers) => {
            if (!validateSemver(phpVersion)) {
                return false;
            }

            if (!phpVersions.find(v => v.php === phpVersion)) {
                return `The allowed PHP versions are ${phpVersions.map((v) => v.php).join(', ')}.`;
            }

            let wpVersion = answers.find(answer => 'wpVersion' === answer.id)?.answer ?? '';

            if ('latest' === wpVersion) {
                wpVersion = wpVersions[(wpVersions.length - 1)].wp;
            }

            const wpVersionParts = wpVersion.split('.');
            const wpVersionMajor = wpVersionParts?.[0] ?? 0;
            const wpVersionMinor = wpVersionParts?.[1] ?? 0;
            const phpVersionMin = wpVersions.find(v => v.wp === `${wpVersionMajor}.${wpVersionMinor}`)?.php?.min ?? '0.0';
            const phpVersionMax = wpVersions.find(v => v.wp === `${wpVersionMajor}.${wpVersionMinor}`)?.php?.max ?? '0.0';

            if (- 1 === compareSemver(phpVersion, phpVersionMin) || 1 === compareSemver(phpVersion, phpVersionMax)) {
                return `PHP version ${phpVersion} is not complatible with WordPress version ${wpVersion}. The allowed PHP versions are ${phpVersionMin} to ${phpVersionMax}.`;
            }

            return true;
        }
    },
    {
        id: 'nodeVersion',
        text: 'Please enter the NodeJS version:',
        isRequired: true,
        defaultAnswer: (answers) => {
            const phpVersion = answers.find(answer => 'phpVersion' === answer.id)?.answer ?? '';

            const phpVersionParts = phpVersion.split('.');
            const phpVersionMajor = phpVersionParts?.[0] ?? 0;
            const phpVersionMinor = phpVersionParts?.[1] ?? 0;

            return phpVersions.find(v => v.php === `${phpVersionMajor}.${phpVersionMinor}`)?.node?.max ?? '19';
        },
        validation: (nodeVersion, answers) => {
            const phpVersion = answers.find(answer => 'phpVersion' === answer.id)?.answer ?? '';
            const phpVersionParts = phpVersion.split('.');
            const phpVersionMajor = phpVersionParts?.[0] ?? 0;
            const phpVersionMinor = phpVersionParts?.[1] ?? 0;
            const nodeVersionMin = phpVersions.find(v => v.php === `${phpVersionMajor}.${phpVersionMinor}`)?.node?.min ?? '0.0';
            const nodeVersionMax = phpVersions.find(v => v.php === `${phpVersionMajor}.${phpVersionMinor}`)?.node?.max ?? '0.0';

            if (- 1 === compareSemver(nodeVersion, nodeVersionMin) || 1 === compareSemver(nodeVersion, nodeVersionMax)) {
                return `NodeJS version ${nodeVersion} is not complatible with PHP version ${phpVersion} image. The allowed NodeJS versions are ${nodeVersionMin} to ${nodeVersionMax}.`;
            }

            return true;
        }
    },
    {
        id: 'containerId',
        text: 'Please enter the ID of the container:',
        defaultAnswer: 'wpdev',
        isRequired: true,
        validation: (containerId) => {
            if (!/^[a-zA-Z0-9_]+$/.test(containerId)) {
                return 'The container ID can only contain letters, numbers, and underscores.';
            }

            return true;
        }
    },
    {
        id: 'volumes',
        text: 'Please enter a volume parameter (Example: /path/in/host:/path/in/container):',
        isRepeat: true,
        validation: (volumes) => {
            if (volumes.find(volume => 2 > volume.split(':').length)) {
                return false;
            }

            return true;
        }
    },
    {
        id: 'environments',
        text: 'Please enter an environment parameter (Example: WORDPRESS_DEBUG=true):',
        isRepeat: true,
        validation: (environments) => {
            if (environments.find(environment => 2 > environment.split('=').length)) {
                return false;
            }

            return true;
        }
    },
    {
        id: 'constants',
        text: 'Please enter a WordPress constant (Example: SCRIPT_DEBUG=true):',
        isRepeat: true,
        validation: (constants) => {
            if (constants.find(constant => 2 > constant.split('=').length)) {
                return false;
            }

            return true;
        }
    },
    {
        id: 'network',
        text: 'Please enter the name of the network for the container:',
        validation: (containerId) => {
            if (!/^[a-zA-Z_]+$/.test(containerId)) {
                return 'The network can only contain letters and underscores.';
            }

            return true;
        }
    },
    {
        id: 'shareSSHKey',
        text: 'Do you want to share the SSH key from the host with the container [y/n]?',
        defaultAnswer: 'y',
    },
    {
        id: 'generateSSHKey',
        text: 'Do you want to generate an SSH key in the container [y/n]?',
        defaultAnswer: 'y',
        isSkip: (answers) => {
            return 'y' === answers.find(({ id }) => 'shareSSHKey' === id)?.answer?.toLowerCase();
        },
    },
    {
        id: 'gitUserName',
        text: 'Please enter your Git config user.name:',
    },
    {
        id: 'gitUserEmail',
        text: 'Please enter your Git config user.email:',
        validation: validateEmail,
    },
    {
        id: 'outputLocation',
        text: 'Please enter the location on the host where the output should be saved:',
        isRequired: true,
        defaultAnswer: './output',
    },
])
    .then((answers) => {
        const wpVersion = answers.find(({ id }) => 'wpVersion' === id)?.answer;
        const phpVersion = answers.find(({ id }) => 'phpVersion' === id)?.answer;
        const containerId = answers.find(({ id }) => 'containerId' === id)?.answer;
        const volumes = answers.find(({ id }) => 'volumes' === id)?.answer;
        const environments = answers.find(({ id }) => 'environments' === id)?.answer;
        const constants = answers.find(({ id }) => 'constants' === id)?.answer;
        const network = answers.find(({ id }) => 'network' === id)?.answer;
        const shareSSHKey = answers.find(({ id }) => 'shareSSHKey' === id)?.answer;
        const generateSSHKey = answers.find(({ id }) => 'generateSSHKey' === id)?.answer;
        const gitUserEmail = answers.find(({ id }) => 'gitUserEmail' === id)?.answer;
        const gitUserName = answers.find(({ id }) => 'gitUserName' === id)?.answer;
        const nodeVersion = answers.find(({ id }) => 'nodeVersion' === id)?.answer;
        const outputLocation = answers.find(({ id }) => 'outputLocation' === id)?.answer;

        if (!fs.existsSync(outputLocation)) {
            fs.mkdirSync(outputLocation, { recursive: true });
        }

        generateDockerFile({
            generateSSHKey,
            gitUserEmail,
            gitUserName,
            outputLocation,
            phpVersion,
            wpVersion,
            nodeVersion,
        });

        generateDockerCompose({
            constants,
            containerId,
            environments,
            network,
            outputLocation,
            shareSSHKey,
            volumes,
        });

        generateEntryPointScript({
            outputLocation,
            phpVersion,
        });

        generateWPConfig({
            outputLocation,
        });

        generateHtaccess({
            outputLocation,
        });
    })
    .catch((error) => {
        console.error(error);
    });