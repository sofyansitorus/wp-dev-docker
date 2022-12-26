const fs = require('fs')
const readline = require('readline')

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
            console.error(err)
            return
        }

        const output = template
            .split('\n')
            .filter(line => {
                if (-1 !== line.indexOf('ssh-keygen')) {
                    return 'yes' === generateSSHKey
                }

                if (-1 !== line.indexOf('{{gitUserName}}')) {
                    return !!gitUserName
                }

                if (-1 !== line.indexOf('{{gitUserEmail}}')) {
                    return !!gitUserEmail
                }

                if (-1 !== line.indexOf('WORKDIR')) {
                    return !!workDir
                }

                return true
            })
            .map(line => {
                return line
                    .replace(new RegExp('{{image}}', 'g'), image)
                    .replace(new RegExp('{{containerUser}}', 'g'), containerUser)
                    .replace(new RegExp('{{gitUserName}}', 'g'), gitUserName)
                    .replace(new RegExp('{{gitUserEmail}}', 'g'), gitUserEmail)
                    .replace(new RegExp('{{workDir}}', 'g'), workDir)
            })
            .join('\n')

        fs.writeFileSync(`${outputLocation}/Dockerfile`, output)

        console.log(`Successfully created Dockerfile file at ${outputLocation}`)
    })
}

const generateDockerCompose = ({
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
            console.error(err)
            return
        }

        const output = template
            .split('\n')
            .filter(line => {
                if (-1 !== line.indexOf('~/.ssh')) {
                    return 'yes' === shareSSHKey
                }

                if (-1 !== line.indexOf('name: {{network}}')) {
                    return !!network
                }

                return true
            })
            .map(line => {
                return line
                    .replace(new RegExp('{{containerId}}', 'g'), containerId)
                    .replace(new RegExp('{{containerUser}}', 'g'), containerUser)
                    .replace(new RegExp('{{network}}', 'g'), network)
            })
            .reduce((accumulator, currentValue) => {
                if (environments && -1 !== currentValue.indexOf('WORDPRESS_DB_NAME=WORDPRESS_DB_NAME')) {
                    return accumulator.concat(currentValue, [...environments.split(';').map(environment => `      - ${environment}`)])
                }

                if (volumes && -1 !== currentValue.indexOf('var_www_html:/var/www/html')) {
                    return accumulator.concat(currentValue, [...volumes.split(';').map(volume => `      - ${volume}`)])
                }

                return accumulator.concat(currentValue)
            }, [])
            .join('\n')

        fs.writeFileSync(`${outputLocation}/docker-compose.yml`, output)

        console.log(`Successfully created docker-compose.yml file at ${outputLocation}`)
    })
}

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        )
}

const askQuestion = (rl, question) => {
    return new Promise(resolve => {
        rl.question(question, (answer) => {
            resolve(answer)
        })
    })
}

const askQuestions = (questions) => {
    return new Promise(async (resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        const answers = []

        for (let i = 0; i < questions.length; i++) {
            const { id, text, defaultAnswer, isRequired, isSkip } = questions[i]

            if (isSkip && isSkip.call(null, answers)) {
                continue
            }

            let question = isRequired ? `(*) ${text}` : text

            if (defaultAnswer) {
                question += ` (${defaultAnswer})`
            }

            let answer = await askQuestion(rl, question + ' ')

            if ('' === answer && defaultAnswer) {
                answer = defaultAnswer
            }

            answers.push({
                id,
                answer,
            })
        }

        rl.close()

        let errorMessage

        questions.forEach(({ id, isSkip, isRequired, validation }) => {
            if (isSkip && isSkip.call(null, answers)) {
                return
            }

            const answer = answers.find(answer => answer.id === id)?.answer ?? ''

            if ('' !== answer && validation && !validation.call(null, answer, answers)) {
                errorMessage = `ERROR: The ${id} input is invalid.`
                return false
            }

            if ('' === answer && isRequired) {
                errorMessage = `ERROR: The ${id} input cannot be left blank. Please enter a value.`
                return false
            }
        })

        if (errorMessage) {
            reject(errorMessage)
        }

        resolve(answers)
    })
}

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
        defaultAnswer: 'wpdev',
        isRequired: true,
    },
    {
        id: 'shareSSHKey',
        text: 'Do you want to share the SSH key from the host with the container?',
        defaultAnswer: 'yes',
    },
    {
        id: 'generateSSHKey',
        text: 'Do you want to generate an SSH key in the container?',
        defaultAnswer: 'yes',
        isSkip: (answers) => {
            return 'yes' === answers.find(({ id }) => 'shareSSHKey' === id)?.answer
        }
    },
    {
        id: 'workDir',
        text: 'Please enter the working directory for the container:',
    },
    {
        id: 'containerId',
        text: 'Please enter the ID of the container:',
        isRequired: true,
    },
    {
        id: 'environments',
        text: 'Please enter the environments for the docker service, separating multiple environments with a semicolon:',
    },
    {
        id: 'volumes',
        text: 'Please enter the volumes for the docker service, separating multiple volumes with a semicolon:',
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
    },
])
    .then(answers => {
        const image = answers.find(({ id }) => 'image' === id)?.answer
        const containerUser = answers.find(({ id }) => 'containerUser' === id)?.answer
        const generateSSHKey = answers.find(({ id }) => 'generateSSHKey' === id)?.answer
        const gitUserName = answers.find(({ id }) => 'gitUserName' === id)?.answer
        const gitUserEmail = answers.find(({ id }) => 'gitUserEmail' === id)?.answer
        const workDir = answers.find(({ id }) => 'workDir' === id)?.answer
        const containerId = answers.find(({ id }) => 'containerId' === id)?.answer
        const environments = answers.find(({ id }) => 'environments' === id)?.answer
        const volumes = answers.find(({ id }) => 'volumes' === id)?.answer
        const network = answers.find(({ id }) => 'network' === id)?.answer
        const shareSSHKey = answers.find(({ id }) => 'shareSSHKey' === id)?.answer
        const outputLocation = answers.find(({ id }) => 'outputLocation' === id)?.answer

        if (!fs.existsSync(outputLocation)) {
            fs.mkdirSync(outputLocation, { recursive: true })
        }

        generateDockerFile({
            containerUser,
            generateSSHKey,
            gitUserEmail,
            gitUserName,
            image,
            outputLocation,
            workDir,
        })

        generateDockerCompose({
            containerId,
            containerUser,
            environments,
            network,
            outputLocation,
            shareSSHKey,
            volumes,
        })
    })
    .catch((error) => {
        console.error(error)
    })
