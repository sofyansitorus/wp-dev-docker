const fs = require('fs');
const readline = require('readline');
const os = require('os');

const userInfo = os.userInfo();

const isRootUser = () => {
    return 'root' === userInfo.username || 0 === userInfo.uid || 0 === userInfo.gid
}

const VALID_USERNAME_PATTERN = /^[a-z][a-z0-9]*$/;

const isValidUsername = (username) => {
    return VALID_USERNAME_PATTERN.test(username)
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
    containerUser,
    generateSSHKey,
    gitUserEmail,
    gitUserName,
    image,
    outputLocation,
    sudoer,
}) => {
    fs.readFile('templates/Dockerfile', 'utf8', (err, template) => {
        if (err) {
            console.error(err);
            return;
        }

        const output = template
            .split('\n')
            .filter((line) => {
                if (-1 !== line.indexOf('ssh-keygen')) {
                    return 'y' === generateSSHKey?.toLowerCase();
                }

                if (-1 !== line.indexOf('{{gitUserName}}')) {
                    return !!gitUserName;
                }

                if (-1 !== line.indexOf('{{gitUserEmail}}')) {
                    return !!gitUserEmail;
                }

                if (-1 !== line.indexOf('ARG UID={{uid}}')) {
                    return !isRootUser();
                }

                if (-1 !== line.indexOf('ARG GID={{gid}}')) {
                    return !isRootUser();
                }

                if (-1 !== line.indexOf('RUN addgroup --gid ${GID} {{containerUser}}')) {
                    return !isRootUser();
                }

                if (-1 !== line.indexOf('RUN adduser --uid ${UID} --gid ${GID} --shell /bin/bash --home /home/{{containerUser}} {{containerUser}}')) {
                    return !isRootUser();
                }

                if (-1 !== line.indexOf('RUN usermod -aG sudo {{containerUser}}')) {
                    return !isRootUser() && 'y' === sudoer?.toLowerCase();
                }

                if (-1 !== line.indexOf(`RUN echo '{{containerUser}} ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers`)) {
                    return !isRootUser() && 'y' === sudoer?.toLowerCase();
                }

                if (-1 !== line.indexOf('RUN chown -R {{containerUser}}:{{containerUser}} /var/www/html')) {
                    return !isRootUser();
                }

                if (-1 !== line.indexOf('USER {{containerUser}}')) {
                    return !isRootUser();
                }

                const lineNoSpace = line.replace(/\s+/g, '');

                return 0 !== lineNoSpace.indexOf('#') && '' !== lineNoSpace
            })
            .map((line) => {
                return line
                    .replace(new RegExp('{{image}}', 'g'), image)
                    .replace(new RegExp('{{containerUser}}', 'g'), containerUser)
                    .replace(new RegExp('{{gitUserName}}', 'g'), gitUserName)
                    .replace(new RegExp('{{gitUserEmail}}', 'g'), gitUserEmail)
                    .replace(new RegExp('{{uid}}', 'g'), userInfo.uid)
                    .replace(new RegExp('{{gid}}', 'g'), userInfo.gid)
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
    containerUser,
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
                if (-1 !== line.indexOf('~/.ssh:/home/{{containerUser}}/.ssh:ro')) {
                    return 'y' === shareSSHKey?.toLowerCase() && !isRootUser();
                }

                if (-1 !== line.indexOf('~/.ssh:/root/.ssh:ro')) {
                    return 'y' === shareSSHKey?.toLowerCase() && isRootUser();
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
                    .replace(new RegExp('{{containerUser}}', 'g'), containerUser)
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
        id: 'image',
        text: 'Please enter the name of the docker image:',
        defaultAnswer: 'wordpress:latest',
        isRequired: true,
    },
    {
        id: 'containerUser',
        text: 'Please enter the user for the container:',
        defaultAnswer: userInfo.username,
        isRequired: true,
        isSkip: isRootUser,
        validation: (containerUser) => {
            if ('root' === containerUser) {
                return 'User root is not allowed.'
            }

            if (!isValidUsername(containerUser)) {
                return 'The user must start with a lowercase letter and can be followed by a mix of numeric and lowercase letters.'
            }
        }
    },
    {
        id: 'sudoer',
        text: 'Do you want to add the user to sudoer group [y/n]?',
        defaultAnswer: 'n',
        isSkip: isRootUser,
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
        text: 'Please enter an environment parameter (Example: VIRTUAL_HOST=yourdomain.tld):',
        isRepeat: true,
    },
    {
        id: 'volumes',
        text: 'Please enter a volume parameter (Example: /path/in/host:/path/in/container):',
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
        id: 'constants',
        text: 'Please enter a WordPress constant (Example: WP_DEBUG=true):',
        isRepeat: true,
    },
    {
        id: 'outputLocation',
        text: 'Please enter the location on the host where the output should be saved:',
        isRequired: true,
        defaultAnswer: './output',
    },
])
    .then((answers) => {
        const constants = answers.find(({ id }) => 'constants' === id)?.answer;
        const containerId = answers.find(({ id }) => 'containerId' === id)?.answer;
        const containerUser = answers.find(({ id }) => 'containerUser' === id)?.answer;
        const environments = answers.find(({ id }) => 'environments' === id)?.answer;
        const generateSSHKey = answers.find(({ id }) => 'generateSSHKey' === id)?.answer;
        const gitUserEmail = answers.find(({ id }) => 'gitUserEmail' === id)?.answer;
        const gitUserName = answers.find(({ id }) => 'gitUserName' === id)?.answer;
        const image = answers.find(({ id }) => 'image' === id)?.answer;
        const network = answers.find(({ id }) => 'network' === id)?.answer;
        const outputLocation = answers.find(({ id }) => 'outputLocation' === id)?.answer;
        const shareSSHKey = answers.find(({ id }) => 'shareSSHKey' === id)?.answer;
        const sudoer = answers.find(({ id }) => 'sudoer' === id)?.answer;
        const volumes = answers.find(({ id }) => 'volumes' === id)?.answer;

        if (!fs.existsSync(outputLocation)) {
            fs.mkdirSync(outputLocation, { recursive: true });
        }

        generateDockerFile({
            containerUser,
            generateSSHKey,
            gitUserEmail,
            gitUserName,
            image,
            outputLocation,
            sudoer,
        });

        generateDockerCompose({
            constants,
            containerId,
            containerUser,
            environments,
            network,
            outputLocation,
            shareSSHKey,
            volumes,
        });

        generateWPConfig({
            outputLocation,
        });
    })
    .catch((error) => {
        console.error(error);
    });