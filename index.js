const fs = require('fs');
const readline = require('readline');
const os = require('os');

const userInfo = os.userInfo();

const isRootUser = () => {
    return 'root' === userInfo.username || 0 === userInfo.uid || 0 === userInfo.gid
}

const phpVersions = [
    '7.0',
    '7.1',
    '7.2',
    '7.3',
    '7.4',
    '8.0',
    '8.1',
    '8.2',
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
}) => {
    fs.readFile(`templates/php${phpVersion}/Dockerfile`, 'utf8', (err, template) => {
        if (err) {
            console.error(err);
            return;
        }

        const wpVersionNormalized = 'latest' === wpVersion ? wpVersion : `wordpress-${wpVersion}`

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

                if (-1 !== line.indexOf('name: {{network}}')) {
                    return !!network;
                }

                const lineNoSpace = line.replace(/\s+/g, '');

                return 0 !== lineNoSpace.indexOf('#') && '' !== lineNoSpace
            })
            .map((line) => {
                return line
                    .replace(new RegExp('{{containerId}}', 'g'), containerId)
                    .replace(new RegExp('{{network}}', 'g'), network)
            })
            .reduce((accumulator, currentValue) => {
                if (
                    environments.length &&
                    -1 !== currentValue.indexOf('WORDPRESS_DB_NAME=wordpress')
                ) {
                    return accumulator.concat(currentValue, [
                        ...environments.map((environment) => `      - ${environment}`),
                    ]);
                }

                if (
                    volumes.length &&
                    -1 !== currentValue.indexOf('var_www_html:/var/www/html')
                ) {
                    return accumulator.concat(currentValue, [
                        ...volumes.map((volume) => `      - ${volume}`),
                    ]);
                }

                if (
                    constants.length &&
                    -1 !== currentValue.indexOf('WORDPRESS_CONFIG_EXTRA')
                ) {
                    return accumulator.concat(currentValue, [
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
    fs.readFile(`templates/php${phpVersion}/docker-entrypoint.sh`, 'utf8', (err, template) => {
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

        const output = template.replace(new RegExp('{{secretKey}}', 'g'), generateWordPressSecretKey);

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

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

const askQuestion = (rl, question, defaultAnswer) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });

        if (defaultAnswer) {
            rl.write(defaultAnswer);
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

            let answer = await askQuestion(rl, isRepeat ? `${question} (#${repeatCounter}) ` : `${question} `, defaultAnswer)

            if (isRepeat) {
                const answersRepeat = [];

                while ('' !== answer) {
                    answersRepeat.push(answer)

                    answer = await askQuestion(rl, `${question} (#${++repeatCounter}) `, defaultAnswer)
                }

                answers.push({
                    id,
                    answer: answersRepeat.filter((value, index, self) => self.indexOf(value) === index),
                });
            } else {
                answers.push({
                    id,
                    answer,
                });
            }
        }

        rl.close();

        let errorMessage;

        questions.forEach(({ id, isSkip, isRequired, validation }) => {
            if (isSkip && isSkip.call(null, answers)) {
                return;
            }

            const answer = answers.find((answer) => answer.id === id)?.answer ?? '';

            if ('' !== answer && validation) {
                const isValid = validation.call(null, answer, answers);

                if (false === isValid) {
                    errorMessage = `ERROR: The ${id} input is invalid.`;
                    return false;
                }

                if ('string' === typeof isValid || isValid instanceof String) {
                    errorMessage = `ERROR: ${isValid}`;
                    return false;
                }
            }

            if ('' === answer && isRequired) {
                errorMessage = `ERROR: The ${id} input cannot be left blank. Please enter a value.`;
                return false;
            }
        });

        if (errorMessage) {
            reject(errorMessage);
        }

        resolve(answers);
    });
};

askQuestions([
    {
        id: 'phpVersion',
        text: 'Please enter the PHP version:',
        defaultAnswer: '7.4',
        isRequired: true,
        validation: (phpVersion) => {
            if (-1 === phpVersions.indexOf(phpVersion)) {
                return `Allowed PHP versions is ${phpVersions.join(', ')}`;
            }

            return true;
        }
    },
    {
        id: 'wpVersion',
        text: 'Please enter the WordPress version:',
        defaultAnswer: 'latest',
        isRequired: true,
        validation: (wpVersion) => {
            if ('latest' === wpVersion) {
                return true;
            }

            const isValidVersion = validateSemver(wpVersion);

            if (isValidVersion && - 1 === compareSemver(wpVersion, '5.0')) {
                return 'Allowed WordPress version is 5.0 or higher';
            }

            return isValidVersion;
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
        id: 'containerId',
        text: 'Please enter the ID of the container:',
        defaultAnswer: 'wpdev',
        isRequired: true,
    },
    {
        id: 'environments',
        text: 'Please enter an environment parameter (Example: WORDPRESS_DEBUG=true):',
        isRepeat: true,
    },
    {
        id: 'volumes',
        text: 'Please enter a volume parameter (Example: /path/in/host:/path/in/container):',
        isRepeat: true,
    },
    {
        id: 'constants',
        text: 'Please enter a WordPress constant (Example: SCRIPT_DEBUG=true):',
        isRepeat: true,
    },
    {
        id: 'network',
        text: 'Please enter the name of the network for the container:',
    },
    {
        id: 'gitUserName',
        text: 'Please enter your Git user name:',
    },
    {
        id: 'gitUserEmail',
        text: 'Please enter your Git user email:',
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
        const phpVersion = answers.find(({ id }) => 'phpVersion' === id)?.answer;
        const wpVersion = answers.find(({ id }) => 'wpVersion' === id)?.answer;
        const constants = answers.find(({ id }) => 'constants' === id)?.answer;
        const containerId = answers.find(({ id }) => 'containerId' === id)?.answer;
        const environments = answers.find(({ id }) => 'environments' === id)?.answer;
        const generateSSHKey = answers.find(({ id }) => 'generateSSHKey' === id)?.answer;
        const gitUserEmail = answers.find(({ id }) => 'gitUserEmail' === id)?.answer;
        const gitUserName = answers.find(({ id }) => 'gitUserName' === id)?.answer;
        const network = answers.find(({ id }) => 'network' === id)?.answer;
        const outputLocation = answers.find(({ id }) => 'outputLocation' === id)?.answer;
        const shareSSHKey = answers.find(({ id }) => 'shareSSHKey' === id)?.answer;
        const volumes = answers.find(({ id }) => 'volumes' === id)?.answer;

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