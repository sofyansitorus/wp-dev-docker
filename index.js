const fs = require('fs')
const readline = require('readline')

const askQuestion = (rl, question) => {
    return new Promise(resolve => {
        rl.question(question, (answer) => {
            resolve(answer)
        })
    })
}

const askQuestions = function (questions) {
    return new Promise(async resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        const answers = []

        for (let i = 0; i < questions.length; i++) {
            const { id, text, defaultAnswer, isSkip } = questions[i];

            if (isSkip && true === isSkip.call(null, answers)) {
                continue
            }

            let question = text;

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

        resolve(answers)
    })
}

askQuestions([
    {
        id: 'image',
        text: 'Enter the docker image name:',
        defaultAnswer: 'wordpress:latest',
    },
    {
        id: 'containerUser',
        text: 'Enter the user in the container:',
    },
    {
        id: 'shareSSHKey',
        text: 'Share SSH Key from host into the container?',
        defaultAnswer: 'yes',
    },
    {
        id: 'generateSSHKey',
        text: 'Generate SSH Key in the container?',
        defaultAnswer: 'yes',
        isSkip: function (answers) {
            return 'yes' === answers.find(({ id }) => 'shareSSHKey' === id)?.answer
        }
    },
    {
        id: 'workDir',
        text: 'Enter the working directory in the container:',
    },
    {
        id: 'containerId',
        text: 'Enter the container ID:',
    },
    {
        id: 'environments',
        text: 'Enter the environments: (Separate by semicolon for mutiple environments)',
    },
    {
        id: 'volumes',
        text: 'Enter the volumes: (Separate by semicolon for mutiple volumes)',
    },
    {
        id: 'network',
        text: 'Enter the network name for the container:',
    },
    {
        id: 'gitUserName',
        text: 'Git User Name:',
    },
    {
        id: 'gitUserEmail',
        text: 'Git User Email:',
    },
    {
        id: 'outputLocation',
        text: 'Enter the output location in host:',
    },
]).then(answers => {
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

    fs.readFile('template.Dockerfile', 'utf8', (err, template) => {
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

    fs.readFile('template-docker-compose.yml', 'utf8', (err, template) => {
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
})
