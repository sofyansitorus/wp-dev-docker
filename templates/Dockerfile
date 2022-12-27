# Image
FROM {{image}}

# Update the OS
RUN apt-get -qq update

# Install apt packages
RUN apt-get -y install unzip curl sudo subversion mariadb-client git software-properties-common gnupg gnupg2 python python3

# Install composer
RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" \
        && php composer-setup.php \
        && php -r "unlink('composer-setup.php');" \
        && mv composer.phar /usr/local/bin/composer \
        && echo "*** composer command installed"

# Install wp-cli
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar

RUN php wp-cli.phar --info

RUN chmod +x wp-cli.phar

RUN mv wp-cli.phar /usr/local/bin/wp

RUN wp --info

# Install yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -

RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

RUN apt-get -qq update

RUN apt-get -y install --no-install-recommends yarn

RUN which yarn

# Set user
RUN useradd -ms /bin/bash {{containerUser}}

RUN usermod -aG www-data {{containerUser}}

RUN usermod -aG sudo {{containerUser}}

# Set sudoer
RUN echo '{{containerUser}} ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers

# Switch user
USER {{containerUser}}

# Generate SSH Key
RUN ssh-keygen -t rsa -N "" -f /home/{{containerUser}}/.ssh/id_rsa

# Config git
RUN git config --global user.name "{{gitUserName}}"

RUN git config --global user.email "{{gitUserEmail}}"

RUN git config --global pull.ff only

# Install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

RUN echo 'export NVM_DIR="$HOME/.nvm"'                                       >> "$HOME/.bashrc"

RUN echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm' >> "$HOME/.bashrc"

RUN echo '[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion" # This loads nvm bash_completion' >> "$HOME/.bashrc"

RUN bash -c 'source $HOME/.nvm/nvm.sh && nvm install node'

# Set working directory
WORKDIR {{workDir}}
