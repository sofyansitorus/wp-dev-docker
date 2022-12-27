# Docker Compose Generator for WordPress Development

This Node.js script generates a `docker-compose.yml` and `Dockerfile` file for a local WordPress development environment using Docker and Docker Compose. The Docker image includes the following packages:

- wp-cli
- PHP Composer
- nvm
- Node.js
- npm
- yarn
- git
- svn

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

## Advanced Usage

#### Custom Domain

You can use a custom domain if you prefer. When prompted with the questions below, you can provide your answer in the format shown in the example below.

1. `Please enter an environment value for the docker service:`

```bash
VIRTUAL_HOST=yourdomain.tld
```

2. `Please enter the name of the network for the container:`

```bash
proxy
```

To use a custom domain, you will need to set up your DNS and install and activate the [NGINX Proxy Automation](https://github.com/evertramos/nginx-proxy-automation) docker. After completing these steps, you can access the WordPress site at http://yourdomain.tld.

#### Custom Domain & SSL

You can use a custom domain and SSL if you prefer. When prompted with the questions below, you can provide your answer in the format shown in the example below.

1. `Please enter an environment value for the docker service:`

```bash
VIRTUAL_HOST=yourdomain.tld
```

```bash
LETSENCRYPT_HOST=yourdomain.tld
```

```bash
LETSENCRYPT_EMAIL=mail@yourdomain.tld
```

2. `Please enter the name of the network for the container:`

```bash
proxy
```

To use a custom domain and SSL, you will need to set up your DNS and install and activate the [NGINX Proxy Automation](https://github.com/evertramos/nginx-proxy-automation) docker. After completing these steps, you can access the WordPress site at https://yourdomain.tld.

#### Volumes

You can define volumes to be mounted within the container as many as needed. When prompted with the following questions, you can provide your responses in the format demonstrated in the following example.

1. `Please enter a volume for the docker service:`

```bash
./woongkir:/var/www/html/wp-content/plugins/woongkir
```

```bash
./Divi:/var/www/html/wp-content/themes/Divi
```

## Customization

You can customize the templates for each service in the `templates` directory. The script will use these templates as a starting point for generating the `docker-compose.yml` and `Dockerfile` file.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Contributing

This project is licensed under the [MIT](https://chat.openai.com/chat/LICENSE) License.
