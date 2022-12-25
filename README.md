# Docker Compose Generator for WordPress Development

This Node.js script generates a `docker-compose.yml` and `Dockerfile` file for a local WordPress development environment using Docker and Docker Compose. The Docker image includes the following packages:

- wp-cli
- PHP Composer
- nvm
- Node.js
- npm
- yarn

## Prerequisites

- Node.js v10.0.0 or higher
- Docker
- Docker Compose

## Installation

1. Clone the repository

```bash
git clone https://github.com/sofyansitorus/wp-dev-docker.git wp-dev-docker
```

2. Navigate to the project directory

```bash
cd wp-dev-docker
```

## Usage

1. Run the script

```bash
node index.js
```

2. Follow the prompts to enter the necessary information for your `docker-compose.yml` and `Dockerfile` file

3. Navigate to the directory where the generated `docker-compose.yml` and `Dockerfile` file is located and run the following command:

```bash
docker-compose up
```

This will build and start the containers specified in the `docker-compose.yml` file. You can then access the WordPress site at http://localhost.

## Customization

You can customize the templates for each service in the `templates` directory. The script will use these templates as a starting point for generating the `docker-compose.yml` and `Dockerfile` file.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Contributing

This project is licensed under the [MIT](https://chat.openai.com/chat/LICENSE) License.
