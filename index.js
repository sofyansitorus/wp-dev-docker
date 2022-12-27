const fs = require('fs');
const readline = require('readline');

const generateDockerFile = ({
    containerUser,
    generateSSHKey,
    gitUserEmail,
    gitUserName,
    image,
    outputLocation,
    workDir,
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

                if (-1 !== line.indexOf('WORKDIR')) {
                    return !!workDir;
                }

                return true;
            })
            .map((line) => {
                return line
                    .replace(new RegExp('{{image}}', 'g'), image)
                    .replace(new RegExp('{{containerUser}}', 'g'), containerUser)
                    .replace(new RegExp('{{gitUserName}}', 'g'), gitUserName)
                    .replace(new RegExp('{{gitUserEmail}}', 'g'), gitUserEmail)
                    .replace(new RegExp('{{workDir}}', 'g'), workDir);
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
                if (-1 !== line.indexOf('~/.ssh')) {
                    return 'y' === shareSSHKey?.toLowerCase();
                }

                if (-1 !== line.indexOf('name: {{network}}')) {
                    return !!network;
                }

                return true;
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

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

const askQuestion = (rl, question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
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

            let answer = await askQuestion(rl, isRepeat ? `${question} (#${repeatCounter}) ` : `${question} `)

            if ('' === answer && defaultAnswer) {
                answer = defaultAnswer;
            }

            if (isRepeat) {
                const answersRepeat = [];

                while ('' !== answer) {
                    repeatCounter++;
                    answersRepeat.push(answer)

                    answer = await askQuestion(rl, `${question} (#${repeatCounter}) `)
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

            if (
                '' !== answer &&
                validation &&
                !validation.call(null, answer, answers)
            ) {
                errorMessage = `ERROR: The ${id} input is invalid.`;
                return false;
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
        text: 'Please enter the name of the docker image [wordpress:latest]:',
        defaultAnswer: 'wordpress:latest',
        isRequired: true,
    },
    {
        id: 'containerUser',
        text: 'Please enter the user for the container [wpdev]:',
        defaultAnswer: 'wpdev',
        isRequired: true,
    },
    {
        id: 'shareSSHKey',
        text: 'Do you want to share the SSH key from the host with the container? [Y/n]',
        defaultAnswer: 'y',
    },
    {
        id: 'generateSSHKey',
        text: 'Do you want to generate an SSH key in the container? [Y/n]',
        defaultAnswer: 'y',
        isSkip: (answers) => {
            return 'y' === answers.find(({ id }) => 'shareSSHKey' === id)?.answer?.toLowerCase();
        },
    },
    {
        id: 'workDir',
        text: 'Please enter the working directory for the container [/var/www/html]:',
        defaultAnswer: '/var/www/html',
    },
    {
        id: 'containerId',
        text: 'Please enter the ID of the container [wpdev]:',
        defaultAnswer: 'wpdev',
        isRequired: true,
    },
    {
        id: 'environments',
        text: 'Please enter an environment parameter: (Example: VIRTUAL_HOST=yourdomain.tld)',
        isRepeat: true,
    },
    {
        id: 'volumes',
        text: 'Please enter a volume parameter: (Example: /path/in/host:/path/in/container:ro)',
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
        text: 'Please enter a WordPress constant: (Example: WP_DEBUG=true)',
        isRepeat: true,
    },
    {
        id: 'outputLocation',
        text: 'Please enter the location on the host where the output should be saved [./output]:',
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
        const volumes = answers.find(({ id }) => 'volumes' === id)?.answer;
        const workDir = answers.find(({ id }) => 'workDir' === id)?.answer;

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
            workDir,
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
    })
    .catch((error) => {
        console.error(error);
    });